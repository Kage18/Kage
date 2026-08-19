// Request guards for the local API.
//
// "It only binds 127.0.0.1" is not a security model. A browser on this machine will
// happily send a cross-site POST to localhost — no CORS permission is needed to *send*
// one, only to read the response — and a DNS-rebinding attack turns an attacker's
// hostname into a request that arrives here looking local. Today the blast radius is
// memory poisoning. The moment a run-control route exists, any page the user has open
// could dispatch an agent with edit permissions into their repository.
//
// So: same-origin only, host must be loopback, and every mutating route needs a token
// that never leaves the user's disk (0600).
import { randomBytes } from "node:crypto";

export interface GuardContext {
  /** Loopback origins this server answers on, e.g. ["http://127.0.0.1:3111"]. */
  allowedOrigins: string[];
  /** Secret from the 0600 status file. */
  token: string;
  /**
   * This machine's own LAN addresses (no port), populated only when LAN mode is on.
   * A request whose Host header names one of these is a legitimate LAN request, not a
   * DNS-rebinding attempt — everything else still fails the Host check exactly as
   * before, LAN mode or not.
   */
  lanHosts?: Set<string>;
  /**
   * The pairing secret LAN requests must present — distinct from `token`, which lives in
   * a 0600 file only local processes can read and is not a fit credential for a
   * network-reachable port. Required on every LAN request, reads included.
   */
  lanToken?: string;
}

export interface GuardedRequest {
  method: string;
  /** Raw header bag, as node gives it. */
  headers: Record<string, string | string[] | undefined>;
  pathname: string;
}

export interface GuardVerdict {
  ok: boolean;
  status: number;
  reason?: string;
}

const OK: GuardVerdict = { ok: true, status: 200 };

/** Reads a header case-insensitively, collapsing the array form node may hand back. */
function header(request: GuardedRequest, name: string): string {
  const raw = request.headers[name] ?? request.headers[name.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value.trim() : "";
}

/** Only these methods are safe to serve without a token. */
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Strips the port and unwraps bracketed IPv6, leaving a bare hostname/address. */
function bareHost(hostHeader: string): string {
  if (!hostHeader) return "";
  return hostHeader.startsWith("[")
    ? hostHeader.slice(1, hostHeader.indexOf("]"))
    : hostHeader.split(":")[0];
}

export function isLoopbackHost(hostHeader: string): boolean {
  if (!hostHeader) return false;
  const host = bareHost(hostHeader);
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}

export function guardRequest(request: GuardedRequest, context: GuardContext): GuardVerdict {
  // 1. DNS rebinding: the attacker controls a hostname that resolves to 127.0.0.1, so the
  // packet is genuinely local but the *browser* thinks it is talking to evil.example.
  // The Host header is what gives that away. In LAN mode, a Host naming one of THIS
  // machine's own LAN addresses is also accepted — anything else is refused exactly as
  // before, because widening the check to "any host" would reopen the same rebinding hole.
  const host = header(request, "host");
  const loopback = isLoopbackHost(host);
  const lan = !loopback && context.lanHosts !== undefined && context.lanHosts.has(bareHost(host));
  if (!loopback && !lan) {
    return { ok: false, status: 403, reason: `refusing a request for host "${host || "(none)"}" — this API answers on loopback${context.lanHosts ? " or this machine's LAN address" : " only"}` };
  }

  // 2. Cross-site requests: a browser always sends Origin on cross-origin POSTs. A missing
  // Origin is fine (curl, the CLI, the desktop shell, most native mobile HTTP clients); a
  // FOREIGN one never is — this stays meaningful in LAN mode because allowedOrigins is the
  // caller's list, which only ever contains this daemon's own loopback and LAN origins.
  const origin = header(request, "origin");
  if (origin && !context.allowedOrigins.includes(origin)) {
    return { ok: false, status: 403, reason: `refusing a request from origin ${origin}` };
  }

  // 3. A request that arrived on a LAN address is never trusted the way a loopback one is
  // — anything on the local network could have sent it. It needs the pairing secret on
  // EVERY request, reads included, not just mutations.
  if (lan) {
    const presented = bearerToken(request);
    if (!context.lanToken) {
      return { ok: false, status: 503, reason: "LAN mode is enabled but no pairing secret has been provisioned" };
    }
    if (!presented || !safeEqual(presented, context.lanToken)) {
      return { ok: false, status: 401, reason: "this request arrived over the LAN and requires the pairing secret" };
    }
    return OK;
  }

  // 4. Loopback: anything that changes state needs the token from the user's own disk.
  if (!READ_METHODS.has(request.method.toUpperCase())) {
    const presented = bearerToken(request);
    if (!context.token) {
      return { ok: false, status: 503, reason: "no API token has been provisioned for this daemon" };
    }
    if (!presented || !safeEqual(presented, context.token)) {
      return { ok: false, status: 401, reason: "this route changes state and requires the daemon token" };
    }
  }
  return OK;
}

export function bearerToken(request: GuardedRequest): string {
  const auth = header(request, "authorization");
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return header(request, "x-kage-token");
}

/** Constant-time-ish compare so the token cannot be probed a byte at a time. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

export function makeToken(): string {
  return randomBytes(32).toString("hex");
}

export function loopbackOrigins(port: number): string[] {
  return [`http://127.0.0.1:${port}`, `http://localhost:${port}`, `http://[::1]:${port}`];
}

/** Same-origin allowlist for this machine's own LAN addresses, one per address. */
export function lanOrigins(addresses: string[], port: number): string[] {
  return addresses.map((address) => `http://${address}:${port}`);
}
