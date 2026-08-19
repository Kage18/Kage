// Tests for the receipt redesign (verify.ts's renderClaimCard, app-client.ts's
// renderReceipt) — kept out of delegation.test.ts deliberately: that file is a
// merge-conflict hotspot (several runs collide in it on the same day), so a new,
// independently growable surface gets its own file.
//
// Fixtures below mirror three REAL runs from this repo's own .agent_memory/runs
// (gitignored, so not readable in a fresh checkout — the shapes are reproduced here
// verbatim): build-a-stale-memory-triage-surface-do-n-260818-ec2c (VERIFIED, commands
// actually ran), clean-up-mcp-kernel-ts-mcp-cli-ts-and-mc-260812-3e61 (UNVERIFIED,
// only static checks — the agent's own unsure note is what told a human a whole class
// of false positives was not reproducible), fix-the-citation-extractor-false-positiv-
// 260818-06a1 (NOT VERIFIED, a real failing `npm test` exit code).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import type { ClaimRecord } from "./delegation/contract.js";
import { delegationAppHtml } from "./delegation/app-html.js";
import { APP_CLIENT } from "./delegation/app-client.js";
import { claimVerdict, renderClaimCard } from "./delegation/verify.js";

const VERIFIED_CLAIM: ClaimRecord = {
  schema_version: 1,
  run_id: "build-a-stale-memory-triage-surface-do-n-260818-ec2c",
  statement: "the stale-memory triage surface is built and wired into the review flow",
  checks: [
    { id: "tests", kind: "command", cmd: "npm test --prefix mcp", expect: "exit code 0", result: "pass", exit_code: 0, evidence: "evidence/tests.log" },
    { id: "diff-size", kind: "diff", expect: "at most 800 changed lines", result: "pass", evidence: "evidence/diff-size.log" },
    { id: "citations", kind: "citation", expect: "every formally cited path exists (directly, or as a unique suffix) in the worktree", result: "pass", evidence: "evidence/citations.log" },
  ],
  unsure: [],
  learnings: [],
  protocol_ok: true,
  diff: { files: 4, lines: 212 },
  created_at: "2026-08-18T16:34:01.294Z",
};

const UNVERIFIED_CLAIM: ClaimRecord = {
  schema_version: 1,
  run_id: "clean-up-mcp-kernel-ts-mcp-cli-ts-and-mc-260812-3e61",
  statement:
    "mcp/kernel.ts, mcp/cli.ts, and mcp/index.ts had their dead code removed with no change to any public function signature or CLI/MCP-tool contract.",
  checks: [
    { id: "diff-size", kind: "diff", expect: "at most 400 changed lines", result: "pass", evidence: "evidence/diff-size.log" },
    { id: "citations", kind: "citation", expect: "every cited path exists in the worktree", result: "pass", evidence: "evidence/citations.log" },
  ],
  unsure: [
    "Could not run npm install / tsc / node --test in this environment — all process execution was blocked behind an approval gate with no interactive user to grant it. A reviewer should run npm run build && npm test before merging to confirm no TypeScript errors.",
  ],
  learnings: [],
  protocol_ok: true,
  diff: { files: 3, lines: 66 },
  created_at: "2026-08-12T13:06:16.129Z",
};

const NOT_VERIFIED_CLAIM: ClaimRecord = {
  schema_version: 1,
  run_id: "fix-the-citation-extractor-false-positiv-260818-06a1",
  statement: "work delivered — see diff (agent skipped the kage-claim-v1 fence)",
  checks: [
    { id: "tests", kind: "command", cmd: "npm test --prefix mcp", expect: "exit code 0", result: "fail", exit_code: 1, evidence: "evidence/tests.log" },
    { id: "diff-size", kind: "diff", expect: "at most 800 changed lines", result: "pass", evidence: "evidence/diff-size.log" },
    { id: "citations", kind: "citation", expect: "every cited path exists in the worktree", result: "pass", evidence: "evidence/citations.log" },
  ],
  unsure: [],
  learnings: [],
  protocol_ok: false,
  diff: { files: 0, lines: 0, paths: [] },
  created_at: "2026-08-18T07:28:08.091Z",
};

// --- CLI/TUI card (renderClaimCard) -----------------------------------------------

test("the three verdict shapes render distinguishably on the CLI card, from the first line", () => {
  const verifiedCard = renderClaimCard(VERIFIED_CLAIM, { budget: 800 });
  const unverifiedCard = renderClaimCard(UNVERIFIED_CLAIM, { budget: 400 });
  const notVerifiedCard = renderClaimCard(NOT_VERIFIED_CLAIM, { budget: 800 });

  // A reader must be able to tell the three apart from the opening characters, not by
  // scanning the whole receipt — and WHO checked this ("checks run by Kage, not the
  // agent") now leads every one of them instead of trailing in a parenthetical.
  assert.match(verifiedCard, /^┌ VERIFIED \d+\/\d+ — checks run by Kage, not the agent/);
  assert.match(unverifiedCard, /^┌ UNVERIFIED — nothing was executed/);
  assert.match(notVerifiedCard, /^┌ NOT VERIFIED \d+\/\d+ — checks run by Kage, not the agent/);

  // A command that actually ran reads "ran"; a static check that only inspected a
  // fact (diff size, a cited path existing) reads "inspected" — never the same
  // register. The unverified card has no command checks at all, so no row anywhere
  // on it may claim "ran".
  assert.match(verifiedCard, /^│ ✓ tests\s+ran\s+npm test --prefix mcp → exit 0/m);
  assert.match(verifiedCard, /^│ ✓ diff-size\s+inspected/m);
  assert.match(notVerifiedCard, /^│ ✗ tests\s+ran\s+npm test --prefix mcp → exit 1/m);
  assert.match(unverifiedCard, /^│ ✓ diff-size\s+inspected/m);
  assert.match(unverifiedCard, /^│ ✓ citations\s+inspected/m);
  assert.doesNotMatch(unverifiedCard, /^│ [✓✗?·] \S+\s+ran\s/m);

  // The agent's own unsure note — often the most valuable line on the card — is
  // still present and readable.
  assert.match(unverifiedCard, /⚠ unsure {6}Could not run npm install/);
});

test("the CLI receipt folds cost into the touched line when spend is known, and never fabricates a cost when it is not", () => {
  const withSpend = renderClaimCard(VERIFIED_CLAIM, {
    budget: 800,
    task: { spend: { usd_est: 1.23, minutes: 4.5 } } as any,
  });
  assert.ok(
    withSpend.includes("· touched     4 file(s), 212 line(s)  ·  cost $1.23 · 4.5 min"),
    "cost must read on the same line as what it bought, not as separate trailing metadata",
  );

  const noSpendReported = renderClaimCard(VERIFIED_CLAIM, {
    budget: 800,
    task: { spend: { usd_est: 0, minutes: 0 } } as any,
  });
  assert.doesNotMatch(noSpendReported, /cost/);

  const noTaskAtAll = renderClaimCard(VERIFIED_CLAIM, { budget: 800 });
  assert.doesNotMatch(noTaskAtAll, /cost/);
});

// --- App receipt card (app-client.ts's renderReceipt) -------------------------------
//
// app-client.ts is a browser script with no DOM available under `node --test`. Rather
// than assert against its source text (which proves nothing about behavior), the real
// exported APP_CLIENT string is evaluated in a fresh vm context against a minimal
// element stub, and the actual renderReceipt function is called directly — the same
// function the real app runs, just fed a fake `document`. Top-level DOM wiring elsewhere
// in the script throws immediately in this context (no real page), but that happens
// AFTER function declarations are hoisted, so renderReceipt is already available.

interface FakeElement {
  tagName: string;
  className: string;
  textContent: string;
  children: FakeElement[];
  onclick: (() => void) | null;
  title: string;
  appendChild(child: FakeElement): FakeElement;
}

function makeFakeElement(tag: string): FakeElement {
  const el = {
    tagName: tag,
    className: "",
    textContent: "",
    children: [] as FakeElement[],
    onclick: null,
    title: "",
  } as FakeElement;
  el.appendChild = (child: FakeElement) => {
    el.children.push(child);
    return child;
  };
  return el;
}

function loadRenderReceipt(): (bodyOuter: FakeElement, claim: unknown, run: unknown, verdict: unknown, taught: unknown) => void {
  const sandbox: Record<string, unknown> = {
    document: {
      createElement: (tag: string) => makeFakeElement(tag),
      createTextNode: (text: string) => ({ nodeType: 3, textContent: text }),
      getElementById: () => null,
    },
    window: {},
    console,
  };
  try {
    runInNewContext(APP_CLIENT, sandbox, { timeout: 2000 });
  } catch {
    // Expected: the rest of the script wires up real DOM elements that do not exist
    // here. Function declarations (renderReceipt included) are hoisted before any
    // statement runs, so they still land on the sandbox regardless.
  }
  const fn = sandbox.renderReceipt;
  assert.equal(typeof fn, "function", "renderReceipt must still be defined after evaluating APP_CLIENT in a DOM-less context");
  return fn as (bodyOuter: FakeElement, claim: unknown, run: unknown, verdict: unknown, taught: unknown) => void;
}

function findAll(root: FakeElement, cls: string): FakeElement[] {
  const out: FakeElement[] = [];
  const walk = (el: FakeElement): void => {
    for (const child of el.children ?? []) {
      if (typeof child.className === "string" && child.className.split(" ").includes(cls)) out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

test("a check with no exit code renders as an em dash on the app receipt, never as 0", () => {
  const renderReceipt = loadRenderReceipt();
  const outer = makeFakeElement("div");
  renderReceipt(outer, VERIFIED_CLAIM, null, claimVerdict(VERIFIED_CLAIM), []);

  const evSpans = findAll(outer, "ev");
  assert.equal(evSpans.length, VERIFIED_CLAIM.checks.length);
  VERIFIED_CLAIM.checks.forEach((check, i) => {
    if (check.kind === "command") {
      assert.equal(evSpans[i].textContent, `exit ${check.exit_code}`);
    } else {
      // diff-size and citations never ran a command — there is no exit code to show.
      // Rendering "" or "0" here would be indistinguishable from a passing exit code.
      assert.equal(evSpans[i].textContent, "—");
      assert.notEqual(evSpans[i].textContent, "0");
    }
  });
});

test("the CLI and app receipts agree on the verdict string for the same claim, for all three shapes", () => {
  const renderReceipt = loadRenderReceipt();
  for (const claim of [VERIFIED_CLAIM, UNVERIFIED_CLAIM, NOT_VERIFIED_CLAIM]) {
    const verdict = claimVerdict(claim);
    const cliCard = renderClaimCard(claim, { budget: 800 });
    assert.ok(cliCard.includes(verdict.label), `CLI card for ${claim.run_id} must contain the kernel's verdict label verbatim`);

    const outer = makeFakeElement("div");
    renderReceipt(outer, claim, null, verdict, []);
    const stamp = findAll(outer, "stamp")[0];
    assert.ok(stamp, `app receipt for ${claim.run_id} must render a stamp`);
    const label = stamp.children[0];
    assert.equal(label.textContent, verdict.label, `app card for ${claim.run_id} must show the same label the CLI card shows — one kernel verdict, two renderings`);
  }
});

// --- the composed page ---------------------------------------------------------------

test("the composed app page still parses as valid JS after the receipt redesign", () => {
  const html = delegationAppHtml("test-token");
  const scriptMatches = [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  const inlineScript = scriptMatches.filter((m) => !/\bsrc\s*=/.test(m[1] ?? "")).pop()?.[2];
  assert.ok(inlineScript, "composed page must have an inline <script> with no src attribute");

  const tmpDir = mkdtempSync(join(tmpdir(), "kage-receipt-test-"));
  try {
    const tmpFile = join(tmpDir, "composed-app.js");
    writeFileSync(tmpFile, inlineScript!, "utf8");
    // Throws (failing the test) on a syntax error — this is the same class of bug that
    // once killed the whole app: a raw backtick or un-escaped ${ inside app-client.ts
    // breaks the composed page even though app-client.ts alone is valid TypeScript.
    execFileSync(process.execPath, ["--check", tmpFile], { encoding: "utf8" });
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
