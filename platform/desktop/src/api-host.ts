// The API worker.
//
// Runs in an Electron utility process — a real OS process with its own event loop — so a slow
// derivation blocks neither the window nor the next request. That is the whole point: the code it
// calls is synchronous and sometimes takes seconds, and the previous architecture put it on a
// single-threaded HTTP daemon where one derivation starved everything behind it. Measured on this
// repository: `/v2/overview` alone 0.059s, the same call while a board derived 12.65s.
//
// It talks over `parentPort`, so there is no port, no socket, no supervision, and nothing to leak.
// Requests are correlated by an id because several can legitimately be in flight at once.

import type { MessageEvent } from "electron";

interface ApiRequest {
  id: number;
  /** Where the compiled Kage core lives; the host cannot resolve it for itself. */
  coreDir: string;
  projectDir: string;
  pathname: string;
  search: string;
}

interface ApiReply {
  id: number;
  status: number;
  body: unknown;
}

type Dispatch = (projectDir: string, pathname: string, search: string) => Promise<{ status: number; body: unknown }>;

let dispatch: Dispatch | null = null;

function loadDispatch(coreDir: string): Dispatch {
  if (dispatch) return dispatch;
  /* eslint-disable @typescript-eslint/no-var-requires */
  const mod = require(`${coreDir}/vnext/desktop/api-dispatch.js`) as { dispatchApi: Dispatch };
  /* eslint-enable @typescript-eslint/no-var-requires */
  dispatch = mod.dispatchApi;
  return dispatch;
}

process.parentPort.on("message", (event: MessageEvent) => {
  const request = event.data as ApiRequest;
  void (async () => {
    let reply: ApiReply;
    try {
      const run = loadDispatch(request.coreDir);
      const result = await run(request.projectDir, request.pathname, request.search);
      reply = { id: request.id, status: result.status, body: result.body };
    } catch (error) {
      // A worker that dies takes the whole app's API with it, so nothing is allowed to throw out
      // of here — a failure is an honest 503 like any other.
      reply = {
        id: request.id,
        status: 503,
        body: { ok: false, error: error instanceof Error ? error.message : String(error) },
      };
    }
    process.parentPort.postMessage(reply);
  })();
});
