// One read API, callable without HTTP.
//
// The daemon's request handler was a thin wrapper around functions that already return data —
// `matchPortalRoute` + `handlePortalRoute` for the model-backed routes, and a handful of direct
// calls for the derived ones. This lifts that routing out of `ServerResponse` so the same answers
// can be produced in-process.
//
// WHY, measured rather than assumed. The desktop app used to run a separate daemon and talk to it
// over loopback HTTP, and that cost far more than it bought:
//
//   The daemon is single-threaded and its heavy work is SYNCHRONOUS, so one derivation starved
//   every other request. Measured on this repository: `/v2/overview` alone 0.059s; the same call
//   issued while a full board derived took 12.65s. That head-of-line blocking — not any individual
//   endpoint — is what "all the pages are slow" actually was.
//
//   It also forced ports, supervision, health probes, cold starts, retries, and a protocol
//   forwarder that leaked a socket per SSE reconnect. Every one of those is machinery in service
//   of a network boundary that does not exist: there is no second machine and no second user.
//
// The app now runs this in an Electron utility process — a real worker, so a slow derivation
// blocks neither the UI nor the next request. The daemon keeps using the same dispatcher for
// `kage viewer`, which is a genuine HTTP surface for a browser.

export interface ApiResponse {
  status: number;
  body: unknown;
}

function notFound(what: string): ApiResponse {
  return { status: 404, body: { ok: false, error: what } };
}

function unavailable(what: string, error: unknown): ApiResponse {
  const detail = error instanceof Error ? error.message : String(error);
  return { status: 503, body: { ok: false, error: `${what} unavailable: ${detail}` } };
}

/**
 * Answer one read request.
 *
 * Never throws: a failing route degrades to an honest 503 naming what could not be produced, the
 * same contract the HTTP layer had. `search` is the raw query string (with or without `?`).
 */
export async function dispatchApi(projectDir: string, pathname: string, search = ""): Promise<ApiResponse> {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  // ── Derived routes: computed from packets + git + the command log, never from the model ──
  // These work on any Node build, which is why they are answered before the model is opened.

  if (pathname === "/v2/attention") {
    try {
      const { attentionQueue } = await import("../orchestrator/attention.js");
      return { status: 200, body: { items: attentionQueue(projectDir) } };
    } catch (error) {
      return unavailable("attention derivation", error);
    }
  }

  if (pathname === "/v2/work") {
    try {
      const { buildWorkBoard } = await import("../orchestrator/board.js");
      // `?knowledge=0` skips one recall + risk report PER CARD — most of a cold board.
      const knowledge = params.get("knowledge") !== "0";
      return { status: 200, body: buildWorkBoard(projectDir, { knowledge }) };
    } catch (error) {
      return unavailable("the work board", error);
    }
  }

  if (pathname.startsWith("/v2/work/")) {
    const workId = decodeURIComponent(pathname.slice("/v2/work/".length));
    try {
      const { buildWorkDetail } = await import("../orchestrator/work-detail.js");
      const detail = buildWorkDetail(projectDir, workId);
      // A missing item is a 404, never an empty item rendered as though it existed.
      return detail ? { status: 200, body: detail } : notFound(`no work item: ${workId}`);
    } catch (error) {
      return unavailable("the work item", error);
    }
  }

  if (pathname === "/v2/proof") {
    try {
      const { buildProof } = await import("../orchestrator/proof.js");
      return { status: 200, body: buildProof(projectDir) };
    } catch (error) {
      return unavailable("proof", error);
    }
  }

  if (pathname === "/v2/agents") {
    try {
      const { buildAgentsReport } = await import("../orchestrator/agents.js");
      return { status: 200, body: buildAgentsReport(projectDir) };
    } catch (error) {
      return unavailable("the agents report", error);
    }
  }

  // ── Model-backed routes ────────────────────────────────────────────────────────────────────
  // These need the compiled repository model, and therefore `node:sqlite`.

  try {
    const { matchPortalRoute, handlePortalRoute } = await import("../api/router.js");
    const route = matchPortalRoute(pathname);
    // A `/v2/...` path the portal API does not define — an honest 404, not a stray answer.
    if (!route) return notFound("not_found");

    const { openRepositoryModel } = await import("../migration/model-store.js");
    const { ReceiptStore } = await import("../storage/receipt-store.js");
    const opened = openRepositoryModel(projectDir);
    try {
      const receiptStore = new ReceiptStore(opened.model.database);
      // teamReport is assembled ONLY for its own route; every other route ignores it. `team` is
      // null because a local reader has no workspace — rendered as "no workspace connected",
      // never as a zeroed panel.
      let teamReport: unknown;
      if (route.kind === "team_report") {
        try {
          const { teamValueReport } = await import("../../kernel.js");
          teamReport = teamValueReport(projectDir);
        } catch {
          teamReport = null;
        }
      }
      const result = handlePortalRoute(route, { model: opened.model, receiptStore, team: null, teamReport }, params);
      return { status: result.status, body: result.body };
    } finally {
      // Opened and closed per request so this never holds the runtime's writer lock.
      opened.close();
    }
  } catch (error) {
    return unavailable("the repository model", error);
  }
}
