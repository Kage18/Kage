import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The owner's decision (2026-08-19): every storefront sold Kage as a memory
// library when the shipped product is an orchestrator that manages memory
// AND agents. "Kage manages your memory and agents" is the owner's own
// wording, used verbatim as the lead on every surface below. If any surface
// reverts to a memory-only lead (or reintroduces OKF as the positioning),
// these tests fail.
//
// __dirname is mcp/dist/ at runtime (compiled test), so sibling mcp/ sources
// need one ".." and repo-root files need two, matching the convention in
// release.test.ts's "kernel's index" and "every command" tests.
const OWNERS_LINE = "Kage manages your memory and agents";

const mcpPath = (...parts: string[]) => join(__dirname, "..", ...parts);
const repoPath = (...parts: string[]) => join(__dirname, "..", "..", ...parts);

test("the CLI's core usage header leads with the owner's line", () => {
  const source = readFileSync(mcpPath("cli.ts"), "utf8");
  const coreStart = source.indexOf("const CORE_USAGE");
  const coreEnd = source.indexOf("`;", coreStart);
  const help = source.slice(coreStart, coreEnd);
  assert.ok(help.includes(OWNERS_LINE), "CORE_USAGE header must lead with the owner's line");
});

test("README headline leads with the owner's line", () => {
  const readme = readFileSync(repoPath("README.md"), "utf8");
  const headlineIndex = readme.indexOf("### ");
  const headline = readme.slice(headlineIndex, readme.indexOf("\n", headlineIndex));
  assert.equal(headline, `### ${OWNERS_LINE}`, "README's headline under the banner must be the owner's line");
});

test("mcp/package.json description leads with the owner's line", () => {
  const pkg = JSON.parse(readFileSync(mcpPath("package.json"), "utf8")) as { description: string };
  assert.ok(pkg.description.startsWith(OWNERS_LINE), "npm listing description must lead with the owner's line");
  assert.ok(
    pkg.description.includes("MCP server, no account, no API key"),
    "npm listing must keep the factual MCP server / no account / no API key claim",
  );
});

test("server.json description leads with the owner's line", () => {
  const manifest = JSON.parse(readFileSync(repoPath("server.json"), "utf8")) as { description: string };
  assert.ok(manifest.description.startsWith(OWNERS_LINE), "server.json description must lead with the owner's line");
});

test("both plugin manifests lead with the owner's line and stay consistent with each other", () => {
  const claude = JSON.parse(
    readFileSync(repoPath("plugin", ".claude-plugin", "plugin.json"), "utf8"),
  ) as { description: string };
  const codex = JSON.parse(
    readFileSync(repoPath("plugin", ".codex-plugin", "plugin.json"), "utf8"),
  ) as { description: string };

  assert.ok(claude.description.startsWith(OWNERS_LINE), "claude plugin manifest must lead with the owner's line");
  assert.ok(codex.description.startsWith(OWNERS_LINE), "codex plugin manifest must lead with the owner's line");
  assert.equal(claude.description, codex.description, "both plugin manifests must carry the same description");
});

test("no shipped description leads with OKF", () => {
  // OKF is a factual file-format guarantee, not the pitch — it must never be
  // the first thing a reader learns about Kage on any of these five surfaces.
  const source = readFileSync(mcpPath("cli.ts"), "utf8");
  const coreStart = source.indexOf("const CORE_USAGE");
  const coreEnd = source.indexOf("`;", coreStart);
  const cliHeader = source.slice(coreStart, coreEnd).split("\n")[0];

  const readme = readFileSync(repoPath("README.md"), "utf8");
  const headlineIndex = readme.indexOf("### ");
  const readmeHeadline = readme.slice(headlineIndex, readme.indexOf("\n", headlineIndex));

  const pkg = JSON.parse(readFileSync(mcpPath("package.json"), "utf8")) as { description: string };
  const server = JSON.parse(readFileSync(repoPath("server.json"), "utf8")) as { description: string };
  const claudePlugin = JSON.parse(
    readFileSync(repoPath("plugin", ".claude-plugin", "plugin.json"), "utf8"),
  ) as { description: string };
  const codexPlugin = JSON.parse(
    readFileSync(repoPath("plugin", ".codex-plugin", "plugin.json"), "utf8"),
  ) as { description: string };

  const leads = [cliHeader, readmeHeadline, pkg.description, server.description, claudePlugin.description, codexPlugin.description];
  for (const lead of leads) {
    assert.doesNotMatch(lead.slice(0, 20), /OKF/i, `lead must not open with OKF: "${lead}"`);
  }
});

// Guards this run's own constraint: editing descriptions must never touch the
// version-lockstep contract mcp/release.test.ts already enforces.
test("editing positioning copy did not disturb version lockstep", () => {
  const version = (JSON.parse(readFileSync(mcpPath("package.json"), "utf8")) as { version: string }).version;
  const manifests = [
    repoPath("server.json"),
    repoPath("plugin", ".claude-plugin", "plugin.json"),
    repoPath("plugin", ".codex-plugin", "plugin.json"),
    repoPath("shell", "package.json"),
  ];
  for (const path of manifests) {
    const manifest = JSON.parse(readFileSync(path, "utf8")) as { version?: string; packages?: Array<{ version?: string }> };
    assert.equal(manifest.version, version, `${path} version must still match package.json (${version})`);
    for (const pkg of manifest.packages ?? []) {
      assert.equal(pkg.version, version, `${path} packages[].version must still match package.json (${version})`);
    }
  }
});
