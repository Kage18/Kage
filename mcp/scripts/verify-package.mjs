// Does the thing a customer actually downloads work?
//
// This repo has shipped a feature that passed every source-checkout test and was 404-broken for
// every npm user, twice. The reason is structural: a source checkout has node_modules, a repo
// around it, and a dist/ that was built in place — none of which a published tarball has. So the
// only honest gate is to pack, install into a directory with no repo in sight, and run the real
// front door.
//
// Exits non-zero on the first failure with the reason. Nothing here is a smoke test that passes
// because a command printed something: every check asserts on the content.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const MCP = join(dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];
let failed = 0;

function check(name, fn) {
  try {
    const detail = fn();
    checks.push({ name, ok: true, detail: detail ?? "" });
  } catch (error) {
    failed += 1;
    checks.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });

// ── Pack ─────────────────────────────────────────────────────────────────────────────────────
const stage = mkdtempSync(join(tmpdir(), "kage-verify-"));
let tarball;

check("the package packs", () => {
  const out = run("npm", ["pack", "--pack-destination", stage], { cwd: MCP });
  tarball = join(stage, out.trim().split("\n").pop().trim());
  if (!existsSync(tarball)) throw new Error(`npm pack reported ${tarball} but it does not exist`);
  const bytes = readFileSync(tarball).length;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
});

// A consumer directory with NO repo, NO .agent_memory, and none of this project's node_modules.
const consumer = join(stage, "consumer");
mkdirSync(consumer, { recursive: true });
writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "consumer", private: true }, null, 2));

check("it installs into a clean directory", () => {
  run("npm", ["install", "--no-audit", "--no-fund", tarball], { cwd: consumer });
  return "installed";
});

const cli = join(consumer, "node_modules", "@kage-core", "kage-graph-mcp", "dist", "cli.js");

check("the published tarball actually contains the built CLI", () => {
  if (!existsSync(cli)) throw new Error(`${cli} is missing — dist/ did not make it into the package`);
  return cli.slice(consumer.length + 1);
});

// The Librarian is the product. Its modules must be IN the tarball and must load with node
// builtins alone — the desktop app ships this same dist without node_modules.
check("the Librarian core is in the package", () => {
  const dir = join(consumer, "node_modules", "@kage-core", "kage-graph-mcp", "dist", "vnext", "librarian");
  const required = ["operations.js", "store.js", "card.js", "librarian.js", "miner.js", "mcp-tools.js", "hook.js"];
  const missing = required.filter((file) => !existsSync(join(dir, file)));
  if (missing.length) throw new Error(`missing from the tarball: ${missing.join(", ")}`);
  return `${required.length} modules present`;
});

// ── Run it, in a scratch git repo, exactly as a new user would ────────────────────────────────
const project = join(stage, "project");
mkdirSync(join(project, "src"), { recursive: true });
writeFileSync(join(project, "src", "limits.ts"), "export const tenantLimit = 100;\n");
run("git", ["init", "-q", "-b", "main"], { cwd: project });
run("git", ["-c", "user.email=t@t.dev", "-c", "user.name=T", "add", "-A"], { cwd: project });
run("git", ["-c", "user.email=t@t.dev", "-c", "user.name=T", "commit", "-qm", "initial"], { cwd: project });

// The store must never be the real ~/.kage during a verification run. Belt AND braces, because
// the first version of this file had neither and wrote a store into the operator's actual home:
// KAGE_STORE_ROOT is honoured at both CLI edges, and HOME is redirected so that even a path that
// resolves through homedir() lands in the stage directory.
const storeRoot = join(stage, "store");
const fakeHome = join(stage, "home");
mkdirSync(fakeHome, { recursive: true });
const env = { ...process.env, KAGE_STORE_ROOT: storeRoot, KAGE_HOME: fakeHome, HOME: fakeHome };
const realStore = join(process.env.HOME ?? "/nonexistent", ".kage", "store");
const storesBefore = existsSync(realStore) ? readdirSync(realStore).sort() : [];

check("`kage --help` leads with the product", () => {
  const out = run("node", [cli, "--help"], { cwd: project, env });
  if (!/kage cards/.test(out)) throw new Error("help does not mention `kage cards` — the front door is wrong");
  return `${out.split("\n").length} lines`;
});

check("`kage cards list` works with no store yet", () => {
  const out = run("node", [cli, "cards", "list", "--project", project], { cwd: project, env });
  if (!/no cards|mine/i.test(out)) throw new Error(`unexpected empty-store output: ${out.slice(0, 120)}`);
  return out.trim().split("\n")[0];
});

// `kage install` is the front door the README and the landing page both tell people to run, so it
// is the thing worth proving. It is also the first command here that WRITES, which is what makes
// the store-location assertion meaningful — the read-only commands above create nothing, so
// asserting a store after them tested the assertion, not the product.
check("`kage install` sets the repo up", () => {
  const out = run("node", [cli, "install", "--project", project], { cwd: project, env });
  if (!/kage|memory|store|brief/i.test(out)) throw new Error(`install printed nothing recognisable: ${out.slice(0, 160)}`);
  return out.trim().split("\n").filter(Boolean).pop()?.slice(0, 60) ?? "installed";
});

check("the shadow store is created OUTSIDE the project", () => {
  if (existsSync(join(project, ".kage"))) throw new Error("a .kage directory was created inside the user's repo");
  if (!existsSync(storeRoot)) throw new Error(`install created no store under ${storeRoot}`);
  const shadows = readdirSync(storeRoot);
  if (!shadows.length) throw new Error(`${storeRoot} exists but holds no store for this repo`);
  return `${shadows.length} store at ${storeRoot.slice(stage.length + 1)}`;
});

// The promise is "your project gets exactly one fenced block". Verify the block, not just a file.
check("the repo gets exactly one fenced BRIEF block", () => {
  const target = ["AGENTS.md", "CLAUDE.md"].map((f) => join(project, f)).find((f) => existsSync(f));
  if (!target) throw new Error("install created neither AGENTS.md nor CLAUDE.md");
  const body = readFileSync(target, "utf8");
  const opens = (body.match(/<!--\s*kage:begin/g) ?? []).length;
  if (opens !== 1) throw new Error(`expected exactly 1 kage:begin marker, found ${opens}`);
  if (!/<!--\s*kage:end/.test(body)) throw new Error("the fenced block is not closed");
  return `${target.slice(project.length + 1)}, ${body.split("\n").length} lines`;
});

// The whole pitch is that memory lives outside your repo. A verification run that quietly wrote
// into the operator's real ~/.kage would disprove it while reporting success — this one did,
// before KAGE_STORE_ROOT was honoured at the CLI edge. Never again silently.
check("the real ~/.kage was never touched", () => {
  const after = existsSync(realStore) ? readdirSync(realStore).sort() : [];
  const added = after.filter((entry) => !storesBefore.includes(entry));
  if (added.length) throw new Error(`this run wrote ${added.join(", ")} into ${realStore}`);
  return `${after.length} pre-existing store(s), unchanged`;
});

check("`kage cards recall` answers without a model", () => {
  const out = run("node", [cli, "cards", "recall", "anything", "--project", project], { cwd: project, env });
  if (!out.trim()) throw new Error("recall printed nothing at all");
  return out.trim().split("\n")[0];
});

// THE promise, tested the way a user would discover it was false: stage everything and see what
// git would commit. Counting files in .agent_memory is the wrong assertion — the install may
// legitimately leave local artifacts there; what must never happen is those artifacts entering
// the user's history. (They did: the installed .gitignore used to un-ignore packets/, so a fresh
// install staged a generated repo-map packet.)
check("`git add -A` after install stages no memory files", () => {
  run("git", ["-c", "user.email=t@t.dev", "-c", "user.name=T", "add", "-A"], { cwd: project });
  const staged = run("git", ["diff", "--cached", "--name-only"], { cwd: project }).trim().split("\n").filter(Boolean);
  const memory = staged.filter((path) => path.startsWith(".agent_memory/"));
  if (memory.length) throw new Error(`install would commit ${memory.length} memory file(s): ${memory.slice(0, 3).join(", ")}`);
  return `${staged.length} file(s) staged, none under .agent_memory/`;
});

// The retirement gate: a fresh install must NOT resurrect the legacy heuristic writer. Snapshot
// first — `kage install` legitimately writes here, and attributing ITS packet to auto-distill
// reported a product failure that did not exist.
check("legacy auto-capture is off by default", () => {
  const packets = join(project, ".agent_memory", "packets");
  const before = existsSync(packets) ? readdirSync(packets).filter((f) => f.endsWith(".md")) : [];
  const out = run("node", [cli, "distill", "--project", project, "--session", "verify", "--auto"], {
    cwd: project,
    env,
  });
  const after = existsSync(packets) ? readdirSync(packets).filter((f) => f.endsWith(".md")) : [];
  const added = after.filter((f) => !before.includes(f));
  if (added.length) throw new Error(`auto-distill wrote ${added.length} packet(s) on a fresh install`);
  // Silence is indistinguishable from a broken pipeline, so the retirement must SAY so.
  if (!/retired|legacy capture/i.test(out)) {
    throw new Error(`auto-distill wrote nothing but never said why: ${out.trim().slice(0, 120) || "(no output)"}`);
  }
  return out.trim().split("\n")[0].slice(0, 58);
});

check("the MCP server starts and lists the card tools", () => {
  const server = join(consumer, "node_modules", "@kage-core", "kage-graph-mcp", "dist", "index.js");
  if (!existsSync(server)) throw new Error("dist/index.js (the MCP server) is not in the tarball");
  const source = readFileSync(server, "utf8");
  if (!/kage_cards_recall|LIBRARIAN_TOOL/.test(source)) {
    throw new Error("the MCP server does not register the Librarian's tools");
  }
  return "kage_cards_recall registered";
});

// ── Report ───────────────────────────────────────────────────────────────────────────────────
const pad = Math.max(...checks.map((c) => c.name.length));
console.log("\nPackage verification — what a customer downloads\n");
for (const c of checks) {
  console.log(`  ${c.ok ? "✓" : "✗"}  ${c.name.padEnd(pad)}  ${c.detail}`);
}
console.log(
  failed === 0
    ? `\n${checks.length}/${checks.length} passed. Safe to publish.\n`
    : `\n${failed} of ${checks.length} FAILED. Do not publish.\n`,
);

rmSync(stage, { recursive: true, force: true });
process.exit(failed === 0 ? 0 : 1);
