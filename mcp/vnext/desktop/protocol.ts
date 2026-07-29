// Routing for the desktop app's own URL scheme.
//
// The window loads the portal over a custom scheme (`kage://app/…`) rather than pointing a
// BrowserWindow at `http://127.0.0.1:<port>`. That one decision buys three things:
//
//   The SPA needs no change. It already fetches same-origin relative paths (`new KageApi("")`),
//   and this handler answers those by forwarding to the active repository's daemon — so there is
//   no CORS to configure and no `webSecurity` to weaken.
//
//   Switching repository is a variable change in the main process, not a navigation. One window,
//   no reload, no lost scroll position.
//
//   Nothing remote is ever loaded, so `sandbox`, `contextIsolation` and `nodeIntegration: false`
//   all hold with no exceptions.
//
// The routing itself is a pure function over the request so it can be tested without Electron,
// which is the whole reason it lives here and not in `platform/desktop`.

/** Prefixes the portal fetches from its own origin, which belong to the repository's daemon. */
const API_PREFIXES = ["/v2/", "/health"];

/**
 * The live feed is NOT forwarded. It is a Server-Sent Events stream, and forwarding it through the
 * custom scheme leaked a connection per reconnect: each `net.fetch` of an endpoint that never ends
 * held one of Electron's ~6-per-host sockets open forever. After six reconnects every other request
 * QUEUED indefinitely — measured on a running app as 6 established sockets to the daemon and
 * requests logged as started but never completed. That is what "the pages take ages to load"
 * actually was.
 *
 * The app subscribes once in the main process and pushes changes over IPC instead. A browser still
 * gets real SSE from the daemon that serves it, because there is no custom scheme in the way.
 */
export const LIVE_FEED_PATH = "/kage/events";

export type ProtocolDecision =
  /** Proxy to the active repository's daemon, preserving method and body. */
  | { kind: "forward"; pathname: string; search: string }
  /**
   * Serve from the built portal bundle. `pathname` is always `/app`-prefixed so it can be handed
   * straight to the daemon's `resolveAppAsset`, which already refuses traversal and falls back to
   * index.html for client-side routes — one hardened resolver, not two.
   */
  | { kind: "file"; pathname: string }
  | { kind: "deny"; reason: string };

/**
 * Normalise a request path to the `/app`-rooted form the portal is built for.
 *
 * The portal's Vite `base` is the absolute `/app/`, so its own asset requests already arrive as
 * `/app/assets/…`. Client-side routes arrive bare (`/attention`). Prefixing the bare ones means a
 * single resolver handles both, and the desktop app's URLs stay identical in shape to the ones the
 * daemon serves — so a deep link behaves the same in the app and in a browser.
 */
export function toPortalPath(pathname: string): string {
  if (pathname === "/app" || pathname.startsWith("/app/")) return pathname;
  if (pathname === "/" || pathname === "") return "/app/";
  return `/app${pathname.startsWith("/") ? "" : "/"}${pathname}`;
}

export interface RouteInput {
  url: string;
  /** False when no repository is active — nothing exists to forward an API call to. */
  hasActiveRepo: boolean;
}

export function routeDesktopRequest(input: RouteInput): ProtocolDecision {
  let url: URL;
  try {
    url = new URL(input.url);
  } catch {
    return { kind: "deny", reason: "unparseable request url" };
  }

  // A lone `%` is not valid encoding and decodeURIComponent THROWS on it — an unhandled throw here
  // takes down the request handler for the whole window, so a malformed path is a refusal.
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return { kind: "deny", reason: "malformed percent-encoding" };
  }

  // Traversal survives to here only in ENCODED form. Verified against the URL parser rather than
  // assumed: `new URL()` normalises raw `../` and uppercase `%2E%2E` away itself, so
  // `kage://app/../../etc/passwd` arrives with pathname `/etc/passwd` and there is nothing left to
  // catch. Lowercase `%2e%2e%2f` is NOT normalised — it stays encoded and only decoding reveals
  // `../`. That is the case this check exists for, and it is why the check must run after decoding.
  if (pathname.includes("..")) {
    return { kind: "deny", reason: "path traversal" };
  }

  // Answered, not forwarded, and not an error: the renderer's EventSource sees a closed stream and
  // stops. In the app the live signal arrives over IPC.
  if (pathname === LIVE_FEED_PATH) {
    return { kind: "deny", reason: "the live feed is delivered over IPC in the desktop app" };
  }

  if (API_PREFIXES.some((prefix) => pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix))) {
    if (!input.hasActiveRepo) {
      // Honest 503 rather than a connection error against a port nobody is listening on.
      return { kind: "deny", reason: "no repository is open" };
    }
    return { kind: "forward", pathname, search: url.search };
  }

  return { kind: "file", pathname: toPortalPath(pathname) };
}

/** Where a forwarded request goes. Always loopback — the app never proxies to a remote host. */
export function daemonOrigin(port: number): string {
  return `http://127.0.0.1:${port}`;
}
