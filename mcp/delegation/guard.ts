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

export function isLoopbackHost(hostHeader: string): boolean {
  if (!hostHeader) return false;
  // Strip the port; handle bracketed IPv6.
  const host = hostHeader.startsWith("[")
    ? hostHeader.slice(1, hostHeader.indexOf("]"))
    : hostHeader.split(":")[0];
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}

export function guardRequest(request: GuardedRequest, context: GuardContext): GuardVerdict {
  // 1. DNS rebinding: the attacker controls a hostname that resolves to 127.0.0.1, so the
  // packet is genuinely local but the *browser* thinks it is talking to evil.example.
  // The Host header is what gives that away.
  const host = header(request, "host");
  if (!isLoopbackHost(host)) {
    return { ok: false, status: 403, reason: `refusing a request for host "${host || "(none)"}" — this API answers on loopback only` };
  }

  // 2. Cross-site requests: a browser always sends Origin on cross-origin POSTs. A missing
  // Origin is fine (curl, the CLI, the desktop shell); a FOREIGN one never is.
  const origin = header(request, "origin");
  if (origin && !context.allowedOrigins.includes(origin)) {
    return { ok: false, status: 403, reason: `refusing a request from origin ${origin}` };
  }

  // 3. Anything that changes state needs the token from the user's own disk.
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
