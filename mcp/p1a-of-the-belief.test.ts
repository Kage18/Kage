// P1a of the belief-staleness follow-up (docs/design/BELIEF_MEMORY.md "Verification
// stays the law, judged against a snapshot"): beliefStaleReason (mcp/kernel.ts) used to
// judge a belief's staleness by recursing into each cited packet's OWN current citations
// (recallStaleReason) on every single recall. On this repo, where a handful of monolithic
// hot files (mcp/kernel.ts, mcp/delegation/*.ts) are touched by nearly every merge, that
// two-hop check cascaded false-positive staleness onto 49 of 61 merged beliefs regardless
// of whether the belief's own specific claim was still true.
//
// The fix: a belief now carries a SNAPSHOT of its cited packets' own file fingerprints,
// taken at the belief's draft/revision time (snapshotBeliefCitationFingerprints,
// persisted via writeBeliefCitationSnapshot into the belief's frontmatter as
// `citation_fingerprints` + `snapshot_at`). beliefStaleReason compares the CURRENT
// fingerprint of each cited packet FILE against that snapshot -- it never walks into
// the packet's own downstream cited code, at recall time or otherwise. Only a missing
// packet file or a change to the packet FILE's own bytes since the snapshot can
// withhold a belief now; the comparison baseline itself only moves when the belief is
// next (re)snapshotted, which is what ties staleness to revision cadence.
//
// REVERT CHECK: "a belief survives an edit to its cited packet's own cited code, even
// after a snapshot" is the direct regression for this fix -- it fails the moment
// beliefStaleReason goes back to calling recallStaleReason on the cited packet itself
// (the two-hop check this file exists to kill).

import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { beliefsDir, capture, recall, writeBeliefCitationSnapshot } from "./kernel.js";
import { okfConceptToPacket, packetToOkfConcept } from "./okf.js";

if (!process.env.KAGE_HOME) process.env.KAGE_HOME = mkdtempSync(join(tmpdir(), "kage-belief-p1a-test-home-"));

function tempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-belief-p1a-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  return dir;
}

function writeBeliefFile(project: string, fileName: string, title: string, citedPacketRelPath: string, tags: string[] = []): string {
  mkdirSync(beliefsDir(project), { recursive: true });
  const tagsLine = tags.length ? [`tags: [${tags.map((t) => JSON.stringify(t)).join(", ")}]`] : [];
  const body = [
    `---`,
    `type: "belief"`,
    `title: "${title}"`,
    ...tagsLine,
    `---`,
    `# ${title}`,
    ``,
    `A consolidated belief synthesized from repo history, citing ${citedPacketRelPath} as evidence.`,
    ``,
    `**Confidence:** firm`,
    ``,
  ].join("\n");
  const relPath = `.agent_memory/beliefs/${fileName}`;
  writeFileSync(join(project, relPath), body, "utf8");
  return relPath;
}

function captureFooPacket(project: string, srcRelPath: string, contents: string): string {
  writeFileSync(join(project, srcRelPath), contents, "utf8");
  const captured = capture({
    projectDir: project,
    title: "Foo convention decision",
    body: `${srcRelPath} holds a convention this belief cites as evidence.`,
    type: "decision",
    paths: [srcRelPath],
  });
  assert.ok(captured.ok && captured.packet && captured.path, JSON.stringify(captured.errors));
  return relative(project, captured.path!).replace(/\\/g, "/");
}

test("a belief survives an edit to its cited packet's own cited code, even after a snapshot", () => {
  const project = tempProject();
  const packetRelPath = captureFooPacket(project, "src/foo.ts", "export const foo = 1;\n");

  const title = "Foo consolidated belief: unrelated edit survives";
  const beliefRelPath = writeBeliefFile(project, "foo-belief-unrelated.md", title, packetRelPath);
  assert.ok(writeBeliefCitationSnapshot(project, beliefRelPath), "snapshot should be written");

  // Edit the code the PACKET (not the belief) cites, changing its actual grounded
  // content -- a real staleness event for the PACKET. Under the retired two-hop check
  // this alone used to withhold the belief; under P1a it must not, because the
  // belief's snapshot fingerprints the packet FILE, not the packet's downstream
  // citations, and recall never re-derives that live.
  writeFileSync(join(project, "src", "foo.ts"), "export const foo = 2;\n", "utf8");

  const result = recall(project, title, 5);
  assert.ok(result.beliefs?.some((b) => b.title === title), "belief must still serve after its cited packet's own code changed");
  assert.ok(!result.beliefs_withheld?.some((b) => b.title === title), "belief must not be withheld for downstream code drift");
});

test("re-snapshotting after a packet's own content changes clears the staleness by accepting the new baseline", () => {
  const project = tempProject();
  const packetRelPath = captureFooPacket(project, "src/baz.ts", "export const baz = 1;\n");

  const title = "Baz consolidated belief: revision cadence recovery";
  const beliefRelPath = writeBeliefFile(project, "baz-belief-revision-cadence.md", title, packetRelPath);
  assert.ok(writeBeliefCitationSnapshot(project, beliefRelPath), "initial snapshot should be written");

  // The packet FILE itself is edited (e.g. re-verified or amended) -- its bytes now
  // differ from the belief's frozen baseline, so the belief goes stale on recall.
  const packetAbsPath = join(project, packetRelPath);
  const edited = okfConceptToPacket(readFileSync(packetAbsPath, "utf8"))!;
  edited.body = `${edited.body}\n\nRe-verified against current code.`;
  writeFileSync(packetAbsPath, packetToOkfConcept(edited), "utf8");
  const beforeRevision = recall(project, title, 5);
  assert.ok(
    beforeRevision.beliefs_withheld?.some((b) => b.title === title),
    "belief must go stale once the packet it cites diverges from the frozen baseline",
  );

  // Revising the belief (the sleep cycle re-snapshots it) moves the baseline to the
  // packet's NEW bytes -- this is the "revision cadence" half of the tradeoff: only a
  // (re)snapshot can change what counts as fresh, in either direction.
  assert.ok(writeBeliefCitationSnapshot(project, beliefRelPath), "re-snapshot should be written");
  const afterRevision = recall(project, title, 5);
  assert.ok(afterRevision.beliefs?.some((b) => b.title === title), "belief must serve again once re-snapshotted against the new baseline");
  assert.ok(!afterRevision.beliefs_withheld?.some((b) => b.title === title));
});

test("a belief goes stale when its cited packet FILE's own content changes since the snapshot", () => {
  const project = tempProject();
  const packetRelPath = captureFooPacket(project, "src/qux.ts", "export const qux = 1;\n");

  const title = "Qux consolidated belief: packet content drift";
  const beliefRelPath = writeBeliefFile(project, "qux-belief-content-drift.md", title, packetRelPath);
  assert.ok(writeBeliefCitationSnapshot(project, beliefRelPath), "snapshot should be written");

  // Rewrite the PACKET FILE itself (not the code it cites) -- e.g. a body edit at
  // ratification. The belief's snapshot fingerprinted the packet file directly, so
  // this must be caught even though it has nothing to do with downstream citations.
  const packetAbsPath = join(project, packetRelPath);
  const packet = okfConceptToPacket(readFileSync(packetAbsPath, "utf8"))!;
  packet.body = `${packet.body}\n\nRevised with additional detail.`;
  writeFileSync(packetAbsPath, packetToOkfConcept(packet), "utf8");

  const result = recall(project, title, 5);
  assert.ok(
    result.beliefs_withheld?.some((b) => b.title === title),
    "belief must go stale when the packet file it cites has changed content",
  );
  const reason = result.beliefs_withheld?.find((b) => b.title === title)?.reason ?? "";
  assert.match(reason, /content changed since snapshot/);
});

test("a belief goes stale when every packet it cites has been deleted since the snapshot", () => {
  const project = tempProject();
  const packetRelPath = captureFooPacket(project, "src/quux.ts", "export const quux = 1;\n");

  const title = "Quux consolidated belief: all citations deleted";
  const beliefRelPath = writeBeliefFile(project, "quux-belief-all-deleted.md", title, packetRelPath);
  assert.ok(writeBeliefCitationSnapshot(project, beliefRelPath), "snapshot should be written");

  rmSync(join(project, packetRelPath));

  const result = recall(project, title, 5);
  assert.ok(
    result.beliefs_withheld?.some((b) => b.title === title),
    "belief must go stale when every packet it cites is gone since the snapshot",
  );
});

test("writeBeliefCitationSnapshot preserves other frontmatter fields and the belief body", () => {
  const project = tempProject();
  const packetRelPath = captureFooPacket(project, "src/corge.ts", "export const corge = 1;\n");

  const title = "Corge consolidated belief: frontmatter preserved";
  const beliefRelPath = writeBeliefFile(project, "corge-belief-frontmatter.md", title, packetRelPath, ["corge", "frontmatter"]);
  const before = readFileSync(join(project, beliefRelPath), "utf8");
  assert.ok(writeBeliefCitationSnapshot(project, beliefRelPath));
  const after = readFileSync(join(project, beliefRelPath), "utf8");

  assert.match(after, /title: "Corge consolidated belief: frontmatter preserved"/);
  assert.match(after, /tags: \["corge", "frontmatter"\]/);
  assert.match(after, /snapshot_at: "/);
  assert.match(after, /citation_fingerprints: \[/);
  assert.ok(after.includes(before.split("---\n").slice(2).join("---\n")), "body content must be untouched");

  const result = recall(project, title, 5);
  assert.ok(result.beliefs?.some((b) => b.title === title), "belief must still parse and serve after the snapshot rewrite");
});
