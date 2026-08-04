// Where a licence key lives, and the `kage license` command.
//
// Split from license.ts on purpose: verification is a pure function that the app, the CLI and the
// MCP server all call, and keeping it free of filesystem and environment access is what lets it
// be tested exhaustively without a temp directory. This file is the small IO shell around it.
//
// The key lives beside the store, in ~/.kage — NEVER in the project. A licence key is a credential
// belonging to the person who bought it, and committing one to a shared repo would hand a paid
// entitlement to every fork. `home` is threaded as a parameter for the same reason store.ts does
// it: the CLI edge owns the environment, everything below takes what it is given.

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { describeLicense, freeTier, verifyLicense, type LicenseState } from "./license.js";

export function licensePath(home?: string): string {
  return join(home ?? homedir(), ".kage", "license.key");
}

/** Read and verify whatever is installed. Total: a missing or unreadable file is the free tier. */
export function currentLicense(options: { home?: string; now?: Date } = {}): LicenseState {
  const path = licensePath(options.home);
  let raw: string;
  try {
    if (!existsSync(path)) return freeTier();
    raw = readFileSync(path, "utf8");
  } catch {
    // An unreadable licence file is not the user's problem to debug mid-task.
    return freeTier();
  }
  return verifyLicense(raw, { now: options.now });
}

/**
 * Install a key, but only if it actually verifies.
 *
 * Refusing to store an invalid key is the whole value of this function: a customer who pastes a
 * truncated key finds out now, from a message that says what is wrong, rather than in three weeks
 * when a teammate wonders why approvals stopped being signed.
 */
export function activateLicense(
  key: string,
  options: { home?: string; now?: Date } = {},
): { ok: boolean; state: LicenseState; message: string } {
  const state = verifyLicense(key, { now: options.now });
  if (state.status === "invalid") {
    return { ok: false, state, message: state.message ?? "That licence key is not valid." };
  }
  if (state.status === "expired") {
    return { ok: false, state, message: state.message ?? "That licence key has expired." };
  }

  const path = licensePath(options.home);
  try {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(path, key.trim(), { mode: 0o600 });
    chmodSync(path, 0o600);
  } catch (error) {
    return {
      ok: false,
      state,
      message: `The key is valid but could not be saved to ${path}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  return { ok: true, state, message: describeLicense(state) };
}

/** Remove an installed key. Idempotent, and never an error if there was nothing to remove. */
export function deactivateLicense(options: { home?: string } = {}): { removed: boolean; message: string } {
  const path = licensePath(options.home);
  if (!existsSync(path)) return { removed: false, message: "No licence key was installed. Running as solo." };
  try {
    rmSync(path);
  } catch (error) {
    return { removed: false, message: `Could not remove ${path}: ${error instanceof Error ? error.message : String(error)}` };
  }
  // Says what did NOT happen, because this is exactly the moment a user fears losing their work.
  return { removed: true, message: "Licence removed. Every card you have stays exactly where it is." };
}

export interface LicenseCliResult {
  out: string;
  exitCode: number;
}

const USAGE = `kage license — the team licence, verified offline.

  kage license                     what is installed, and what it entitles
  kage license activate <key>      install a key (checked before it is saved)
  kage license deactivate          remove it; cards are never touched
  kage license path                where the key file lives

Solo is free forever and needs no key: every card, every recall, no expiry.
A licence adds the team features and is verified on this machine — no account, nothing called home.`;

/**
 * The `kage license` dispatcher. Returns text rather than printing, so it is testable and so the
 * app can reuse it.
 */
export function runLicenseCommand(
  argv: string[],
  options: { home?: string; now?: Date } = {},
): LicenseCliResult {
  const sub = argv[0] ?? "show";

  if (sub === "--help" || sub === "-h" || sub === "help") return { out: USAGE, exitCode: 0 };

  if (sub === "path") return { out: licensePath(options.home), exitCode: 0 };

  if (sub === "activate") {
    const key = argv[1];
    if (!key) return { out: "Usage: kage license activate <key>", exitCode: 1 };
    const result = activateLicense(key, options);
    return { out: result.message, exitCode: result.ok ? 0 : 1 };
  }

  if (sub === "deactivate") {
    const result = deactivateLicense(options);
    return { out: result.message, exitCode: 0 };
  }

  if (sub === "show") {
    const state = currentLicense(options);
    const lines = [describeLicense(state)];
    if (state.status === "none") lines.push("", "A team licence adds shared-memory governance. `kage license activate <key>` when you have one.");
    return { out: lines.join("\n"), exitCode: 0 };
  }

  return { out: `Unknown subcommand '${sub}'.\n\n${USAGE}`, exitCode: 1 };
}
