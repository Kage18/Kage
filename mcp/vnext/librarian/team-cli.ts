// `kage team` — the sync surface of the shadow store, and the one honest answer to
// "is anyone else's memory actually reaching me?".
//
// DIRECTION.md's team model is deliberately unglamorous: the store is a git repo, so "team" is a
// remote on a host the team already trusts. This surface exposes exactly that much — status,
// remote, push, pull — plus the number that says whether sharing is doing anything at all
// (cross-pollination: cards someone else wrote that were actually served here).
//
// Two shapes are copied from cli.ts on purpose. It returns {exitCode, out} instead of printing,
// so every line a human reads is a string a test can assert on and mcp/cli.ts keeps its one job.
// And the whole surface is one dispatcher, so that file — already ~130 command branches — gains
// ONE branch rather than five, with the flag parsing for team living beside the team verbs.
//
// Three rules this surface will not bend:
//
//   - No remote is NOT an error. "Solo: no remote, fully offline" is a supported, first-class
//     state (DIRECTION.md, "Where memory lives"), so a store without one prints what it IS plus
//     the single command that would change it. Painting a deliberate choice red is how a product
//     teaches people to ignore its warnings.
//   - A conflict is printed as a list of names with the instruction to go resolve it. A pull that
//     answered "merged, 4 cards" while git sat mid-merge would be the reassuring lie that makes
//     someone trust a store nobody has finished merging.
//   - Unmeasured is a dash or an unlock action, never 0. Cross-pollination cannot be measured
//     before cards can arrive from someone else, so with no remote it prints as the action that
//     unlocks it — not as a confident zero. (The old product died of a fabricated number.)

import { storeFor } from "./operations.js";
import { crossPollination, pullCards, pushCards, remoteStatus, setRemote } from "./team.js";
import type { CardStore } from "./store.js";

export interface TeamCliDeps {
  /** Store root override — tests point it at a scratch dir so the real ~/.kage is untouched. */
  storeRoot?: string;
  /** Who "I" am, for cross-pollination. Absent means whoever is at this terminal. */
  me?: string;
}

export interface TeamCliResult {
  exitCode: number;
  out: string;
}

const USAGE = [
  "kage team — your card store is a git repo; a team is a remote on a host you already trust.",
  "",
  "  kage team status [--json]           remote, branch, ahead/behind, and what teammates' memory reached you",
  "  kage team remote <url> [--json]     point this store at the shared repo",
  "  kage team push [--json]             publish the cards this store holds",
  "  kage team pull [--json]             take theirs — and name every conflict rather than hide it",
  "  kage team score [--json]            cross-pollination in full: the total, then who it came from",
  "",
  "  No remote is a supported state, not a broken one: solo stores work fully offline.",
].join("\n");

const SUBCOMMANDS: ReadonlySet<string> = new Set(["status", "remote", "push", "pull", "score"]);

/**
 * Flags that consume the token after them, so the positional url can be found without a parser.
 * `--project` is here because mcp/cli.ts resolves it and then hands us the argv it came in on —
 * we skip it rather than mistake its value for a remote url.
 */
const VALUE_FLAGS: ReadonlySet<string> = new Set(["--project"]);

function has(argv: string[], name: string): boolean {
  return argv.includes(name);
}

function positionals(argv: string[]): string[] {
  const rest: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (VALUE_FLAGS.has(token)) {
      index += 1; // its value belongs to the flag, never to the verb
      continue;
    }
    if (token.startsWith("--")) continue;
    rest.push(token);
  }
  return rest;
}

function ok(out: string): TeamCliResult {
  return { exitCode: 0, out };
}

/** A refusal is a report with a nonzero status — never a thrown stack trace at a human. */
function refuse(out: string): TeamCliResult {
  return { exitCode: 1, out };
}

function plural(count_: number, noun: string): string {
  return `${count_} ${noun}${count_ === 1 ? "" : "s"}`;
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * A number we were actually handed, or null. Written against `unknown` so the renderer stays
 * honest whatever shape team.ts declares: a field that arrives absent, NaN, or null must read as
 * "not measured", never fall through to a confident 0.
 */
function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Non-empty string or null. Same reason: an empty url is not a url, and "" is not a branch. */
function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** The dash is the product's word for "nobody measured this". */
function dash(value: number | null): string {
  return value === null ? "—" : String(value);
}

/**
 * One conflicted thing, however team.ts chooses to name it. Conflicts are the one output this
 * surface may never round off, so an entry whose shape we do not recognise is printed as its own
 * JSON rather than dropped or stringified to "[object Object]" — an unreadable conflict line is
 * still a conflict the human can go look for; a missing one is a merge they think finished.
 */
function conflictLabel(entry: unknown): string {
  if (typeof entry === "string") return entry;
  if (entry !== null && typeof entry === "object") {
    const record = entry as Record<string, unknown>;
    const named = text(record.path) ?? text(record.file) ?? text(record.id) ?? text(record.cardId);
    if (named) return named;
  }
  return JSON.stringify(entry);
}

/**
 * What to say when a sync verb is asked of a store that has nowhere to sync to. Not an error
 * message about a misconfiguration — a description of a legitimate state plus the one command
 * that leaves it.
 */
function soloRefusal(verb: string): string {
  return [
    `No remote configured, so there is nothing to ${verb}.`,
    "This store is local-only — a supported state, not a broken one: it works fully offline.",
    "Point it at the repo your team already trusts:  kage team remote <url>",
  ].join("\n");
}

// ── Rendering ────────────────────────────────────────────────────────────────────────────────

/**
 * The renderer takes loose values on purpose: it is the layer that decides what an absent number
 * looks like, so it must be able to receive one.
 */
interface StatusView {
  dir: string;
  configured: boolean;
  url: unknown;
  branch: unknown;
  ahead: unknown;
  behind: unknown;
  dirty: unknown;
  error: unknown;
  crossTotal: unknown;
  me: string;
}

function syncLine(ahead: unknown, behind: unknown): string {
  const toPush = count(ahead);
  const toPull = count(behind);
  // Either half missing means the comparison never ran (no fetch yet, no upstream). Printing
  // "0 to push" for a comparison that did not happen is the exact class of number this product
  // is not allowed to show.
  if (toPush === null || toPull === null) {
    return "Sync     not measured — run `kage team pull` to compare this store against the remote.";
  }
  if (toPush === 0 && toPull === 0) return "Sync     in step with the remote.";
  return `Sync     ${toPush} to push · ${toPull} to pull`;
}

function workingLine(dirty: unknown): string {
  // Kage writes one commit per mutation (store.ts), so a dirty store repo is somebody else's
  // edit — worth naming, because the next push carries it or trips over it.
  return dirty === true
    ? "Working  uncommitted changes in the store repo — Kage commits every mutation, so this is a hand edit."
    : "Working  clean";
}

function renderStatus(view: StatusView): string {
  const lines = [`Store    ${view.dir}`, `Branch   ${text(view.branch) ?? "—"}`];
  const url = text(view.url);

  if (!view.configured || url === null) {
    lines.push("Remote   none — this store is yours alone, and works fully offline.");
    lines.push(workingLine(view.dirty));
    lines.push("");
    // No teammates means cross-pollination has nothing to count, which is different from having
    // counted nothing. The unlock action says which one this is.
    lines.push("Nothing syncs and nothing leaves this machine, so there is no teammate memory to measure.");
    lines.push("Share it:  kage team remote <url>");
    return lines.join("\n");
  }

  lines.push(`Remote   ${url}`);
  lines.push(syncLine(view.ahead, view.behind));
  lines.push(workingLine(view.dirty));

  const total = count(view.crossTotal);
  lines.push("");
  if (total === null || total === 0) {
    lines.push(`Cross-pollination  nothing written by anyone but ${view.me} has been served here yet.`);
  } else {
    lines.push(`Cross-pollination  ${plural(total, "card")} written by someone else, served here.`);
    lines.push("Who they came from:  kage team score");
  }

  const failure = text(view.error);
  // Reported last and loudly: a status that could not read the remote is a status with a hole in
  // it, and the ahead/behind above may be older than the sentence claims.
  if (failure) lines.push(`Remote read failed: ${failure}`);
  return lines.join("\n");
}

interface AuthorRow {
  author: string;
  delivered: unknown;
}

function renderScore(rows: readonly AuthorRow[], total: number | null, me: string, configured: boolean): string {
  const header = `Cross-pollination — cards written by someone other than ${me}, and actually served here.`;
  if (!configured) {
    return [
      header,
      "",
      "Not measurable yet: this store has no remote, so no card in it was written anywhere else.",
      "Share it:  kage team remote <url>",
    ].join("\n");
  }
  if (total === null || total === 0 || rows.length === 0) {
    return [
      header,
      "",
      "Nothing from a teammate has been served here yet.",
      "Take what they have approved:  kage team pull",
      "Counted from recall receipts, never estimated.",
    ].join("\n");
  }

  const sorted = [...rows].sort(
    (a, b) => (count(b.delivered) ?? 0) - (count(a.delivered) ?? 0) || String(a.author).localeCompare(String(b.author)),
  );
  const width = sorted.reduce((wide, row) => Math.max(wide, String(row.author).length), 0);
  return [
    header,
    "",
    `  ${plural(total, "card")} served, from ${plural(sorted.length, "teammate")}`,
    "",
    // A per-author row whose count never arrived prints a dash rather than borrowing the total.
    ...sorted.map((row) => `  ${String(row.author).padEnd(width)}  ${dash(count(row.delivered))}`),
    "",
    "Counted from recall receipts, never estimated.",
  ].join("\n");
}

// ── The dispatcher ───────────────────────────────────────────────────────────────────────────

export async function runTeamCommand(
  argv: string[],
  projectDir: string,
  deps: TeamCliDeps = {},
): Promise<TeamCliResult> {
  const args = positionals(argv);
  // Bare `kage team` is the status read: the question people actually arrive with is "am I
  // sharing, and is it working", and making them type a verb for it would be ceremony.
  const sub = args[0] ?? "status";
  const wantsJson = has(argv, "--json");

  if (has(argv, "--help") || sub === "help") return ok(USAGE);
  if (!SUBCOMMANDS.has(sub)) return refuse(`Unknown subcommand '${sub}'.\n\n${USAGE}`);

  // Opened only after the verb is known to exist: openStore creates and git-inits a store
  // directory, and a typo must never leave one behind.
  const store: CardStore = storeFor(projectDir, deps.storeRoot);
  // The reviewer's own name, same rule as `kage cards approve`: whoever is at this terminal, and
  // never an empty string recorded as an identity.
  const me = deps.me?.trim() || process.env.USER?.trim() || "local-operator";

  if (sub === "remote") {
    const url = args[1];
    if (!url) {
      return refuse(
        [
          "remote needs a url:  kage team remote <url>",
          "Any git remote your team already trusts — the store is just a git repo.",
        ].join("\n"),
      );
    }
    const result = await setRemote(store, url);
    if (wantsJson) return { exitCode: result.ok ? 0 : 1, out: json({ ...result, url }) };
    if (!result.ok) return refuse(`Could not set the remote: ${text(result.error) ?? "unknown error"}`);
    return ok(
      [
        `Remote set: ${url}`,
        // Setting a remote moves no cards. Saying so prevents the belief that configuring is
        // sharing — the belief that leaves a team's memory sitting on one laptop.
        "Nothing has moved yet — publish what this store holds:  kage team push",
      ].join("\n"),
    );
  }

  // Every remaining verb reads the remote first: three of them have a different, better answer
  // when there is no remote at all, and that answer is not a git error.
  const status = await remoteStatus(store);
  // An error reported while unconfigured is git telling us what we already know. Only a
  // configured remote that could not be read is a failure worth a nonzero status.
  const readFailed = status.configured && text(status.error) !== null;

  if (sub === "status") {
    const cross = await crossPollination(store, me);
    if (wantsJson) {
      return {
        exitCode: readFailed ? 1 : 0,
        out: json({ store: store.dir, me, remote: status, crossPollination: { total: cross.total } }),
      };
    }
    const rendered = renderStatus({
      dir: store.dir,
      configured: status.configured,
      url: status.url,
      branch: status.branch,
      ahead: status.ahead,
      behind: status.behind,
      dirty: status.dirty,
      error: status.error,
      crossTotal: cross.total,
      me,
    });
    return { exitCode: readFailed ? 1 : 0, out: rendered };
  }

  if (sub === "score") {
    const cross = await crossPollination(store, me);
    if (wantsJson) return ok(json({ me, configured: status.configured, ...cross }));
    return ok(renderScore(cross.byAuthor, count(cross.total), me, status.configured));
  }

  if (sub === "push") {
    if (!status.configured) {
      return {
        exitCode: 1,
        out: wantsJson ? json({ ok: false, error: "no remote configured", remote: status }) : soloRefusal("push"),
      };
    }
    const result = await pushCards(store);
    if (wantsJson) return { exitCode: result.ok ? 0 : 1, out: json(result) };
    if (!result.ok) return refuse(`Push failed: ${text(result.error) ?? "unknown error"}`);
    const pushed = count(result.pushed);
    if (pushed === null) return ok("Pushed to the shared store — how much is not measured.");
    if (pushed === 0) return ok("Nothing to push — the remote already has everything this store holds.");
    // Commits, not cards: team.ts counts what git counts, and one card that was proposed,
    // approved and re-verified is three commits. Labelling three commits "3 cards" would be a
    // number with the wrong unit on it, which is just a wrong number.
    return ok(`Pushed ${plural(pushed, "commit")} to the shared store — one commit is one card mutation.`);
  }

  // pull — the only verb that can end in a state a human has to finish.
  if (!status.configured) {
    return {
      exitCode: 1,
      out: wantsJson ? json({ ok: false, error: "no remote configured", remote: status }) : soloRefusal("pull"),
    };
  }
  const result = await pullCards(store);
  const conflicts: unknown[] = [...(result.conflicts ?? [])];
  if (wantsJson) {
    // Conflicts make the exit status nonzero even when the pull itself "succeeded": something is
    // waiting on a human, and a script that only reads exit codes must not be told otherwise.
    return { exitCode: result.ok && conflicts.length === 0 ? 0 : 1, out: json(result) };
  }
  if (conflicts.length > 0) {
    return refuse(
      [
        // "Pulled with conflicts" would claim a finished pull. It stopped.
        `Pull stopped on ${plural(conflicts.length, "conflict")} — two people wrote the same ${
          conflicts.length === 1 ? "card" : "cards"
        } differently.`,
        ...conflicts.map((entry) => `  ${conflictLabel(entry)}`),
        "",
        `Resolve them in the store repo, then commit there:  cd ${store.dir}`,
        // The anti-reassurance. Until the merge is finished every other Kage surface reads these
        // files exactly as they sit on disk, conflict markers and all.
        "Until then the store repo is mid-merge, and every Kage surface reads those files as they sit right now.",
      ].join("\n"),
    );
  }
  if (!result.ok) return refuse(`Pull failed: ${text(result.error) ?? "unknown error"}`);
  const merged = count(result.merged);
  if (merged === null) return ok("Pulled from the shared store — how many cards changed is not measured.");
  if (merged === 0) return ok("Nothing to pull — this store already has every card the remote holds.");
  return ok([`Pulled ${plural(merged, "card")} from the shared store.`, "See them:  kage cards list"].join("\n"));
}
