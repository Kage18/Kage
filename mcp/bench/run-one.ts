// Single-backend, single-run CLI entry point for the M4 benchmark harness
// (mcp/bench/harness.ts). Runs one runBenchmark() call in its own process
// and prints the resulting BenchMeasurement as one line of JSON on stdout.
// Split out from mcp/bench/run.ts (the orchestrator) so the orchestrator
// can cap each run with a real OS-level timeout (child_process's `timeout`
// option can only kill a subprocess, not a synchronous call in its own
// process) and, on macOS, wrap this process in `/usr/bin/time -l` to read
// the real peak RSS the OS measured rather than a coarse in-process sample.
//
// Usage: node dist/bench/run-one.js --files 10000 --packets 1000 --backend json [--seed 1] [--touch 100] [--dir /path] [--keep]

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runBenchmark } from "./harness.js";
import type { BackendKind } from "../store/types.js";

function arg(flag: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx === process.argv.length - 1) return fallback;
  return process.argv[idx + 1];
}

function main(): void {
  const files = Number(arg("--files", "1000"));
  const packets = Number(arg("--packets", String(Math.max(10, Math.round(files / 10)))));
  const seed = Number(arg("--seed", "1"));
  const backend = (arg("--backend", "json") as BackendKind);
  const touchArg = arg("--touch");
  const keep = process.argv.includes("--keep");
  const dirArg = arg("--dir");
  const dir = dirArg ?? mkdtempSync(join(tmpdir(), `kage-bench-${backend}-${files}-`));

  const result = runBenchmark(dir, {
    seed,
    fileCount: files,
    packetCount: packets,
    backend,
    touchCount: touchArg ? Number(touchArg) : undefined,
  });

  process.stdout.write(`${JSON.stringify(result)}\n`);

  if (!keep && !dirArg) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup; a leftover temp dir is not this script's failure to report
    }
  }
}

main();
