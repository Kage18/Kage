// Regression for the beliefs-first recall bug (mcp/kernel.ts beliefStaleReason):
// it conflated a cited packet's terminal LINEAGE status (deprecated/superseded)
// with a real grounding failure. recallStaleReason returns "packet status is
// deprecated"/"superseded" for retired packets -- normal lineage, since a belief
// deliberately synthesizes historical episodes including ones later superseded
// by newer learnings -- but beliefStaleReason withheld the WHOLE belief for it
// exactly like a genuinely broken citation (moved/deleted cited code). Live
// reproduction against the merged beliefs found 54/60 beliefs invisible to
// recall, 46 of those purely from a deprecated/superseded citation.
//
// REVERT CHECK: "belief citing a deprecated-but-otherwise-grounded packet is
// served, not withheld" fails if beliefStaleReason goes back to calling
// recallStaleReason on the citation unmodified -- the status branch would
// withhold the belief again.
//
// P1a (docs/design/BELIEF_MEMORY.md) retired the other direction of this file's
// original second test: "belief citing a packet whose cited code was deleted
// out from under it is still withheld" used to hold on every recall, because
// beliefStaleReason recursed into each cited packet's OWN current citations
// (recallStaleReason) every time. That two-hop check is exactly what cascaded
// false-positive staleness from monolithic hot files onto 49/61 beliefs after
// this file's original fix landed -- so it's gone. A belief's citations are now
// fingerprinted directly (the packet FILE itself) and judged against a snapshot
// taken at the belief's own draft/revision time, not live per-recall re-derivation
// -- see mcp/p1a-of-the-belief.test.ts for that mechanism's full coverage,
// including the "packet with genuinely deleted cited code" case migrated to it.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { beliefsDir, capture, recall } from "./kernel.js";
import { okfConceptToPacket, packetToOkfConcept } from "./okf.js";

if (!process.env.KAGE_HOME) process.env.KAGE_HOME = mkdtempSync(join(tmpdir(), "kage-belief-lineage-test-home-"));

function tempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-belief-lineage-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  return dir;
}

function writeBeliefFile(project: string, fileName: string, title: string, citedPacketRelPath: string): void {
  mkdirSync(beliefsDir(project), { recursive: true });
  const body = [
    `---`,
    `type: "belief"`,
    `title: "${title}"`,
    `---`,
    `# ${title}`,
    ``,
    `A consolidated belief synthesized from repo history, citing ${citedPacketRelPath} as evidence.`,
    ``,
    `**Confidence:** firm`,
    ``,
  ].join("\n");
  writeFileSync(join(beliefsDir(project), fileName), body, "utf8");
}

test("belief citing a deprecated-but-otherwise-grounded packet is served, not withheld", () => {
  const project = tempProject();
  writeFileSync(join(project, "src", "foo.ts"), "export const foo = 1;\n", "utf8");
  const captured = capture({
    projectDir: project,
    title: "Foo convention decision",
    body: "foo.ts holds a stable convention that later episodes superseded with newer learnings.",
    type: "decision",
    paths: ["src/foo.ts"],
  });
  assert.ok(captured.ok && captured.packet && captured.path, JSON.stringify(captured.errors));
  const packetPath = captured.path!;

  // Simulate the packet's lineage status being retired (as a real supersede/gc
  // deprecate eventually marks it) while its cited code stays untouched -- the
  // exact "normal lineage, not a grounding failure" shape the fix must serve.
  const packet = okfConceptToPacket(readFileSync(packetPath, "utf8"))!;
  packet.status = "superseded";
  writeFileSync(packetPath, packetToOkfConcept(packet), "utf8");

  const citedRelPath = relative(project, packetPath).replace(/\\/g, "/");
  const title = "Foo consolidated belief alpha";
  writeBeliefFile(project, "foo-belief-alpha.md", title, citedRelPath);

  const result = recall(project, title, 5);
  assert.ok(result.beliefs?.some((b) => b.title === title), "belief citing a superseded-but-grounded packet must be served");
  assert.ok(
    !result.beliefs_withheld?.some((b) => b.title === title),
    "belief must not be withheld for a citation's lineage status alone",
  );
});

test("belief citing a packet whose cited code was deleted out from under it serves when the belief has no snapshot yet", () => {
  const project = tempProject();
  writeFileSync(join(project, "src", "bar.ts"), "export const bar = 1;\n", "utf8");
  const captured = capture({
    projectDir: project,
    title: "Bar convention decision",
    body: "bar.ts holds a convention this belief cites as evidence.",
    type: "decision",
    paths: ["src/bar.ts"],
  });
  assert.ok(captured.ok && captured.packet && captured.path, JSON.stringify(captured.errors));
  const packetPath = captured.path!;

  // The packet's own cited code is deleted out from under it -- a real grounding
  // failure of the PACKET, but the belief here was never snapshotted (writeBeliefFile
  // is a raw fixture writer with no citation_fingerprints), so beliefStaleReason has
  // no baseline to compare drift against and falls back to "is the cited packet FILE
  // itself gone" -- which it is not. This is the P1a tradeoff stated in
  // docs/design/BELIEF_MEMORY.md: a packet's downstream code-citation staleness no
  // longer cascades up to a belief that cites it, at all, ever -- snapshotted or not.
  rmSync(join(project, "src", "bar.ts"));

  const citedRelPath = relative(project, packetPath).replace(/\\/g, "/");
  const title = "Bar consolidated belief beta";
  writeBeliefFile(project, "bar-belief-beta.md", title, citedRelPath);

  const result = recall(project, title, 5);
  assert.ok(result.beliefs?.some((b) => b.title === title), "a belief with no snapshot must serve until its next revision");
  assert.ok(!result.beliefs_withheld?.some((b) => b.title === title), "a packet's own downstream staleness must not withhold it");
});
