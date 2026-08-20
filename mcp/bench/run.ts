// The M4 benchmark orchestrator (docs/design/MEMORY_STORE.md, "M4 --
// benchmarks and the scale guard"). NOT part of `npm test` -- this is the
// script that was run by hand to produce docs/BENCHMARKS.md's published
// numbers, and can be re-run the same way to reproduce or update them:
//
//   npm run build --prefix mcp
//   node dist/bench/run.js --files 1000,10000 --backends json,sqlite --timeout-ms 900000
//
// Each (fileCount, backend) combination runs in its OWN child process (via
// mcp/bench/run-one.ts) so a real OS-level timeout can cap a run that's
// impractically slow (the brief's own allowance: "if 10k on the json
// backend is impractically slow, CAP the attempt at a stated timeout,
// report 'exceeded <timeout>' honestly") without a synchronous in-process
// call being un-killable. On macOS the child runs under `/usr/bin/time -l`
// so the reported peakRssBytes is the OS's own measured maximum resident
// set size, not an in-process before/after sample.

import { spawnSync } from "node:child_process";
import { join } from "node:path";

function arg(flag: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx === process.argv.length - 1) return fallback;
  return process.argv[idx + 1];
}

interface RunOutcome {
  backend: string;
  fileCount: number;
  [key: string]: unknown;
}

function runOne(scriptPath: string, opts: { files: number; packets: number; seed: number; backend: string; touch?: number; timeoutMs: number }): RunOutcome {
  const args = ["--files", String(opts.files), "--packets", String(opts.packets), "--seed", String(opts.seed), "--backend", opts.backend];
  if (opts.touch !== undefined) args.push("--touch", String(opts.touch));

  const useTimeWrapper = process.platform === "darwin";
  const command = useTimeWrapper ? "/usr/bin/time" : process.execPath;
  const commandArgs = useTimeWrapper ? ["-l", process.execPath, scriptPath, ...args] : [scriptPath, ...args];

  const result = spawnSync(command, commandArgs, { timeout: opts.timeoutMs, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

  if (result.error && (result.error as NodeJS.ErrnoException).code === "ETIMEDOUT") {
    return { backend: opts.backend, fileCount: opts.files, exceeded_timeout_ms: opts.timeoutMs, note: `exceeded ${opts.timeoutMs}ms timeout -- DNF, reported honestly per the M4 brief` };
  }
  if (result.signal) {
    return { backend: opts.backend, fileCount: opts.files, exceeded_timeout_ms: opts.timeoutMs, note: `killed by signal ${result.signal} (timeout of ${opts.timeoutMs}ms most likely cause) -- DNF, reported honestly per the M4 brief` };
  }
  if (result.status !== 0) {
    throw new Error(`run-one exited ${result.status} for backend=${opts.backend} files=${opts.files}:\n${result.stderr}`);
  }
  const lines = (result.stdout ?? "").trim().split("\n").filter(Boolean);
  const lastLine = lines[lines.length - 1];
  const measurement = JSON.parse(lastLine) as RunOutcome;
  if (useTimeWrapper) {
    const match = (result.stderr ?? "").match(/(\d+)\s+maximum resident set size/);
    if (match) (measurement as Record<string, unknown>).peakRssBytesOsMeasured = Number(match[1]);
  }
  return measurement;
}

function main(): void {
  const fileCounts = (arg("--files", "1000,10000") as string).split(",").map((s) => Number(s.trim())).filter((n) => n > 0);
  const backends = (arg("--backends", "json,sqlite") as string).split(",").map((s) => s.trim());
  const seed = Number(arg("--seed", "1"));
  const timeoutMs = Number(arg("--timeout-ms", "900000"));
  const packetsRatio = Number(arg("--packets-ratio", "0.1"));
  const scriptPath = join(__dirname, "run-one.js");

  const results: RunOutcome[] = [];
  for (const files of fileCounts) {
    const packets = Math.max(10, Math.round(files * packetsRatio));
    for (const backend of backends) {
      process.stderr.write(`Running backend=${backend} files=${files} packets=${packets} timeout=${timeoutMs}ms...\n`);
      const outcome = runOne(scriptPath, { files, packets, seed, backend, timeoutMs });
      results.push(outcome);
      process.stderr.write(`  -> ${JSON.stringify(outcome)}\n`);
    }
  }

  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}

main();
