// docs/index.html was rebuilt from the case-file design mockup at
// docs/design/mockups/Website.dc.html (9 scenes: the claim, the wall, case
// No 001, the loop, the memory, while-you-were-out, exhibits, the ledger,
// the total). This file pins that rebuild two ways: the mockup's canvas
// machinery (x-dc/helmet/data-dc-script wrappers) must never leak into the
// shipped page, and the honest, non-invented numbers the brief required —
// the empty-branch counts, the 621/301/2,771/~19M memory ledger, the missed
// 10s warm-index target — must still be present verbatim.
//
// REGRESSION: reverting docs/index.html to its pre-rebuild state (the old
// "OKF badge" hero) fails every content assertion below; reintroducing an
// <x-dc>/<helmet> wrapper, or dropping the new --red/--inset/--physical-paper
// tokens from docs/assets/site.css, fails the corresponding assertion too.
//
// __dirname is mcp/dist/ at runtime (compiled test) — one ".." reaches
// sibling mcp/ sources, two reaches the repo root. Same convention as
// context-doc.test.ts / readme-claims.test.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoPath = (...parts: string[]) => join(__dirname, "..", "..", ...parts);

function readIndex(): string {
  return readFileSync(repoPath("docs", "index.html"), "utf8");
}

function readSiteCss(): string {
  return readFileSync(repoPath("docs", "assets", "site.css"), "utf8");
}

test("docs/index.html strips the mockup's canvas machinery", () => {
  const html = readIndex();
  for (const wrapper of ["<x-dc>", "<helmet>", "data-dc-script", "DCLogic", "class Component extends"]) {
    assert.ok(!html.includes(wrapper), `expected the composed page not to contain mockup wrapper "${wrapper}"`);
  }
});

test("docs/index.html reproduces the case-file scenes in order with the mockup's exact numbers", () => {
  const html = readIndex();

  // scene 1 — the claim: the stamp and the thesis
  assert.match(html, /Not verified/i);
  assert.match(html, /re-run by kage · 2 of 5 checks failed · exit 1/);
  assert.match(html, /Prove it<span class="dot">\.<\/span>/);

  // scene 3 — Case No 001: the empty-branch counts, verbatim
  const caseIdx = html.indexOf("CASE N");
  assert.notEqual(caseIdx, -1, "expected a Case No 001 heading");
  assert.match(html, /commits on the branch.*<span class="zero">0<\/span>/s);
  assert.match(html, /files touched.*<span class="zero">0<\/span>/s);
  assert.match(html, /paths cited in the claim.*4/s);
  assert.match(html, /of those that actually changed.*<span class="zero">0<\/span>/s);

  // scene 4b — the memory ledger: 621 / 301 / 2,771 / ~19M, estimate labelled
  assert.match(html, /621/);
  assert.match(html, /301/);
  assert.match(html, /2,771/);
  assert.match(html, /~19M/);
  assert.match(html, /ESTIMATE — LABELLED/);

  // scene 6 — the ledger admits the missed 10s warm-index target, in amber
  assert.match(html, /8\.3s/);
  assert.match(html, /76ms/);
  assert.match(html, /15\.9s/);
  assert.match(html, /target was 10s\. not met/);
  assert.match(html, /class="lrow miss"/);
  assert.match(html, /1,113 \+ 12/);

  // scene ordering: each scene must appear after the previous one
  const markers = [
    "Not verified",
    "Every one of these ended a session",
    "CASE N",
    "One loop. Three artifacts. Zero trust.",
    "The receipt expires. The memory compounds.",
    "Dispatch a goal. Go to sleep.",
    "Two boards, one lie.",
    "We publish what we measured.",
    "Verified — check it yourself",
  ];
  let cursor = -1;
  for (const marker of markers) {
    const at = html.indexOf(marker);
    assert.ok(at !== -1, `expected scene marker present: "${marker}"`);
    assert.ok(at > cursor, `expected "${marker}" to appear after the previous scene`);
    cursor = at;
  }
});

test("docs/index.html finale ships the install command and the honest bill, and keeps required nav links working", () => {
  const html = readIndex();
  assert.match(html, /npx -y @kage-core\/kage-graph-mcp install/);
  assert.match(html, /MIT · free/);
  assert.match(html, /none — local-first/);

  for (const href of ['href="guide.html"', 'href="benchmarks.html"', 'href="releases.html"', 'href="https://github.com/kage-core/Kage"']) {
    assert.ok(html.includes(href), `expected a working nav/footer link: ${href}`);
  }
  assert.match(html, /assets\/site\.css/);
});

test("docs/assets/site.css extends the shared tokens rather than forking a second palette", () => {
  const css = readSiteCss();
  for (const token of ["--red:", "--inset:", "--physical-paper:", "--physical-ink:", "--physical-ink-2:"]) {
    assert.ok(css.includes(token), `expected site.css to declare the extension token ${token}`);
  }
  // the case-file scene stamps still respect prefers-reduced-motion, and wide
  // rotated/absolute artifacts never force a page-level horizontal scrollbar
  assert.match(css, /overflow-x:\s*hidden/);
});

test("docs/index.html respects prefers-reduced-motion for the stamp and wall animations", () => {
  const html = readIndex();
  const reducedMotionBlocks = html.match(/@media \(prefers-reduced-motion: reduce\) \{[^}]*\}/g) ?? [];
  assert.ok(reducedMotionBlocks.length >= 2, "expected reduced-motion overrides for both the stamp slam and the wall drift");
  assert.ok(reducedMotionBlocks.some((b) => b.includes(".not-verified")), "expected the NOT VERIFIED stamp animation to be disabled under reduced motion");
  assert.ok(reducedMotionBlocks.some((b) => b.includes(".wall-row")), "expected the claim-wall drift animation to be disabled under reduced motion");
});
