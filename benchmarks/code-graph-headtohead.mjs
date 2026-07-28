#!/usr/bin/env node
// Code-graph head-to-head: Kage vs any other code knowledge graph, on the SAME repository.
//
// This benchmark exists because "our graph is better" was asserted repeatedly in this project
// and never measured once. So the metrics are chosen to be able to make Kage look BAD:
//
//   parse_coverage      fraction of source files parsed by a REAL parser rather than falling
//                       back to metadata. A metadata-only file is a filename in a list, not a
//                       node in a graph, and counting it as coverage is how an index gets to
//                       call itself a graph.
//
//   edge_resolution     fraction of call edges whose BOTH ends resolve to a known symbol. This
//                       is the metric that separates a graph from a pile of strings: an edge
//                       with a dangling end cannot be traversed, so it cannot answer "what
//                       calls this". Reported separately from raw edge count precisely because
//                       raw counts reward emitting junk.
//
//   symbols_per_file    extraction density, on files that parsed.
//
//   build_seconds       wall clock for a cold build.
//
// A competitor's numbers are NOT estimated or inferred from documentation. If the tool is not
// installed, its column reads `not measured` and says how to produce it — the same rule the
// product's own Proof page follows.
//
// Usage:
//   node benchmarks/code-graph-headtohead.mjs [--project <dir>] [--json]

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const projectDir = resolve(readArg("--project") ?? process.cwd());
const asJson = args.includes("--json");

function readArg(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

// Source files only. A graph is not judged on whether it indexed a lockfile.
const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|rb|java|kt|swift|c|h|cpp|cs|php)$/;

function measureKage() {
  const kernel = require(join(projectDir, "mcp", "dist", "kernel.js"));
  const started = Date.now();
  const graph = kernel.buildCodeGraph(projectDir);
  const build_seconds = (Date.now() - started) / 1000;

  const sourceFiles = graph.files.filter((file) => SOURCE.test(file.path));
  // `metadata` is the fallback parser: it knows a file exists and nothing about its contents.
  const parsed = sourceFiles.filter((file) => file.parser && file.parser !== "metadata");

  const symbolIds = new Set((graph.symbols ?? []).map((symbol) => symbol.id));
  const calls = graph.calls ?? [];
  // BOTH ends must resolve, or the edge cannot be walked in either direction.
  const resolved = calls.filter((call) => call.from_symbol && symbolIds.has(call.from_symbol)
    && call.to_symbol && symbolIds.has(call.to_symbol));

  return {
    tool: "kage",
    files_total: graph.files.length,
    source_files: sourceFiles.length,
    parse_coverage: sourceFiles.length ? parsed.length / sourceFiles.length : null,
    symbols: (graph.symbols ?? []).length,
    symbols_per_file: parsed.length ? (graph.symbols ?? []).length / parsed.length : null,
    call_edges: calls.length,
    edge_resolution: calls.length ? resolved.length / calls.length : null,
    import_edges: (graph.imports ?? []).length,
    build_seconds,
    parsers: [...new Set(graph.files.map((file) => file.parser))].filter(Boolean),
  };
}

// A competitor is measured only if it is actually installed. Absent, the column says so and
// names the command that would produce it — never a number read off a landing page.
function measureGraphify() {
  const probes = [
    () => execFileSync("graphify", ["--version"], { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "ignore"] }).trim(),
    () => execFileSync("npx", ["--no-install", "graphify", "--version"], { encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "ignore"] }).trim(),
  ];
  for (const probe of probes) {
    try {
      const version = probe();
      return {
        tool: "graphify",
        installed: true,
        version,
        note: "Installed. Run its index over the same project and fill the same fields to compare.",
      };
    } catch { /* try the next probe */ }
  }
  return {
    tool: "graphify",
    installed: false,
    reason: "not installed on this machine",
    unlock: "git clone https://github.com/safishamsi/graphify && (cd graphify && ./graphify install)",
  };
}

const kage = measureKage();
const graphify = measureGraphify();
const report = { project_dir: projectDir, generated_at: new Date().toISOString(), kage, graphify };

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const pct = (value) => (value === null ? "n/a" : `${(value * 100).toFixed(1)}%`);
  console.log(`Code-graph head-to-head — ${projectDir}\n`);
  console.log("KAGE");
  console.log(`  source files      ${kage.source_files} (of ${kage.files_total} indexed)`);
  console.log(`  parse coverage    ${pct(kage.parse_coverage)}   real parser, not the metadata fallback`);
  console.log(`  symbols           ${kage.symbols.toLocaleString()} (${kage.symbols_per_file?.toFixed(1) ?? "n/a"} per parsed file)`);
  console.log(`  call edges        ${kage.call_edges.toLocaleString()}`);
  console.log(`  edge resolution   ${pct(kage.edge_resolution)}   BOTH ends resolve to a known symbol`);
  console.log(`  import edges      ${kage.import_edges.toLocaleString()}`);
  console.log(`  build             ${kage.build_seconds.toFixed(2)}s`);
  console.log(`  parsers           ${kage.parsers.join(", ")}`);
  console.log("\nGRAPHIFY");
  if (graphify.installed) {
    console.log(`  version           ${graphify.version}`);
    console.log(`  ${graphify.note}`);
  } else {
    console.log(`  not measured      ${graphify.reason}`);
    console.log(`  to measure it     ${graphify.unlock}`);
  }
}
