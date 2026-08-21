// Release wiring for the .dmg + auto-update distribution: docs/releases.html gained a
// real "Desktop app" download section, README.md gained a "## Desktop app" section, and
// docs/index.html's finale ("THE TOTAL") section now links the dmg alongside the npx
// install command. This file pins two things at once: the copy is present, and the copy
// stays honest — no release currently carries a .dmg/latest-mac.yml asset (verified via
// `gh release view` against kage-core/Kage during this run), so every download pointer
// must be the releases INDEX page, never a direct asset URL that 404s today. It also
// cross-checks the "every 4 hours" claim against shell/update.js's real
// CHECK_INTERVAL_MS so the docs can't silently drift from the code that backs them.
//
// REGRESSION: reverting any of the three files' release-wiring changes fails the
// corresponding assertion below — the desktop-app sections and their releases-page
// links disappear from docs/releases.html and README.md, and the dmg mention
// disappears from docs/index.html's finale section.
//
// __dirname is mcp/dist/ at runtime (compiled test) — one ".." reaches sibling mcp/
// sources, two reaches the repo root. Same convention as readme-claims.test.ts /
// rebuild-the-website-landing.test.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoPath = (...parts: string[]) => join(__dirname, "..", "..", ...parts);

function readReleasesHtml(): string {
  return readFileSync(repoPath("docs", "releases.html"), "utf8");
}

function readReadme(): string {
  return readFileSync(repoPath("README.md"), "utf8");
}

function readIndexHtml(): string {
  return readFileSync(repoPath("docs", "index.html"), "utf8");
}

function readUpdateJs(): string {
  return readFileSync(repoPath("shell", "update.js"), "utf8");
}

const RELEASES_INDEX_URL = "https://github.com/kage-core/Kage/releases";

test("shell/update.js checks for updates every 4 hours, matching the docs' claim", () => {
  const source = readUpdateJs();
  const match = source.match(/CHECK_INTERVAL_MS\s*=\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+)/);
  assert.ok(match, "expected CHECK_INTERVAL_MS to be a simple numeric product in shell/update.js");
  const [, ...factors] = match!;
  const ms = factors.reduce((acc, f) => acc * Number(f), 1);
  assert.equal(ms, 4 * 60 * 60 * 1000, "CHECK_INTERVAL_MS should be 4 hours — docs/releases.html and README.md both state this");
});

test("docs/releases.html has a real Desktop app section pointing at the releases index, not a dead direct link", () => {
  const html = readReleasesHtml();
  assert.ok(/Kage\.app for macOS|Desktop app/i.test(html), "expected a desktop-app heading in docs/releases.html");
  assert.ok(html.includes(`href="${RELEASES_INDEX_URL}"`), "expected the dmg pointer to link the releases index page");
  assert.ok(/right-click.{0,40}Open/is.test(html), "expected the right-click → Open note for unsigned builds");
  assert.ok(/every 4 hours/i.test(html), "expected the auto-update cadence to be documented");
  assert.ok(/notify/i.test(html), "expected the ad-hoc-build notify-only behavior to be documented");
  assert.ok(
    !/releases\/download\//.test(html),
    "docs/releases.html must not link a direct release-asset download URL — no release currently ships a .dmg",
  );
});

test("README.md has a Desktop app section with a dmg download link and the one-line install alternative", () => {
  const readme = readReadme();
  assert.ok(readme.includes("## Desktop app"), "expected a '## Desktop app' section in README.md");
  const section = readme.slice(readme.indexOf("## Desktop app"), readme.indexOf("## What is Kage"));
  assert.ok(section.includes(RELEASES_INDEX_URL), "expected the Desktop app section to link GitHub releases for the dmg");
  assert.ok(
    section.includes("npx -y @kage-core/kage-graph-mcp install"),
    "expected the Desktop app section to offer the one-line CLI install as an alternative",
  );
  assert.ok(
    !section.includes("releases/download/"),
    "README's Desktop app section must not link a direct release-asset download URL — no release currently ships a .dmg",
  );
});

test("docs/index.html's finale section links the dmg alongside the npx install command", () => {
  const html = readIndexHtml();
  const finaleStart = html.indexOf('<div class="stamp-final">');
  const finaleEnd = html.indexOf("</section>", finaleStart);
  assert.ok(finaleStart > -1 && finaleEnd > finaleStart, "expected to find the finale ('THE TOTAL') section in docs/index.html");
  const finale = html.slice(finaleStart, finaleEnd);
  assert.ok(finale.includes("npx -y @kage-core/kage-graph-mcp install"), "expected the existing npx install command to remain");
  assert.ok(/\.dmg/i.test(finale), "expected a .dmg mention alongside the npx install command");
  assert.ok(finale.includes('href="releases.html"'), "expected the dmg mention to link the releases page");
});
