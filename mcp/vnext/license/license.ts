// Offline licence verification.
//
// Three properties decide the whole design, and each of them is a promise the product already
// makes elsewhere:
//
//   1. NO SERVER, NO PHONE-HOME. "No account, no API key" is on the landing page, and a licence
//      check that calls home would make it false. Verification is a pure function of
//      (key, publicKey, now) — it works on a plane, behind a corporate proxy, and in CI.
//
//   2. IT FAILS OPEN, ALWAYS. An expired, corrupt, forged or absent key degrades to the free
//      tier. It NEVER throws and never withholds a card the user already owns. A memory product
//      whose billing bug costs someone their team's knowledge is finished, and no amount of
//      revenue is worth that failure mode. Every path here returns a status.
//
//   3. THE PUBLIC KEY IS PUBLIC. This is MIT-licensed: anyone can read this file, and anyone
//      determined can delete the `if` that consults it. That is the ordinary open-core position
//      and it is fine — the bet is that paying is cheaper than maintaining a fork forever. The
//      signature is not DRM; it is what stops a licence being *forged* casually, which is the
//      only threat worth engineering against here.
//
// Key format: kage_<base64url(payload)>.<base64url(ed25519 signature)>
// Self-describing, one line, pastes into a terminal or a chat without mangling.

import { verify as edVerify, createPublicKey, type KeyObject } from "node:crypto";

export type Tier = "free" | "team";

/** What a licence asserts. Kept small: every field here has to be defensible in a receipt. */
export interface LicensePayload {
  /** Licence id, so a specific key can be named in support without revealing the whole key. */
  id: string;
  tier: Tier;
  /** Seats purchased. Advisory: nothing here enforces a headcount (see seatStatus). */
  seats: number;
  /** Who it was issued to — org or email. Shown back to the user so they can verify it is theirs. */
  issued_to: string;
  issued_at: string;
  /** ISO date. Absent means perpetual. */
  expires_at?: string;
}

export type LicenseStatus =
  | "none" // no key installed — the free tier, which is a complete product
  | "active"
  | "grace" // past expiry but inside the grace window: still fully functional, and says so
  | "expired"
  | "invalid"; // malformed, or the signature does not verify

export interface LicenseState {
  status: LicenseStatus;
  /** The tier actually in force. `expired` and `invalid` both resolve to "free". */
  tier: Tier;
  payload?: LicensePayload;
  /** Present when the user should be told something. Never an interruption, never a modal. */
  message?: string;
  /** Days remaining before a grace period ends. Only set when status is "grace". */
  graceDaysLeft?: number;
}

/**
 * A lapsed licence keeps working for two more weeks.
 *
 * Deliberate, and not generosity: renewals fail for boring reasons — an expired card, someone on
 * leave, a finance queue — and a team that loses its shared memory mid-sprint over a billing
 * hiccup does not renew, it churns and tells people why. Two weeks is long enough for a human to
 * notice and act, short enough that it is not a second free tier.
 */
export const GRACE_PERIOD_DAYS = 14;

/**
 * The issuing key's public half. Replaced at release time with the real one; the placeholder is
 * a valid, well-formed key that simply signs nothing, so an unconfigured build behaves exactly
 * like a build with no licences issued — free tier, no crash, no warning.
 */
export const ISSUER_PUBLIC_KEY_SPKI =
  "MCowBQYDK2VwAyEA6VYd+8N8pWr0Kk1F0uV0oq0Uq0Wq0Xq0Yq0Zq0aq0bs=";

const DAY_MS = 24 * 60 * 60 * 1000;

function decodeIssuerKey(spki: string): KeyObject | null {
  try {
    return createPublicKey({ key: Buffer.from(spki, "base64"), format: "der", type: "spki" });
  } catch {
    // A malformed issuer key is a build error, not a user error. Fail to "no licences verify",
    // which is the free tier — never a crash on a machine that has done nothing wrong.
    return null;
  }
}

function base64urlToBuffer(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  } catch {
    return null;
  }
}

/** The free tier, named. Returned on every failure path so callers never branch on null. */
export function freeTier(message?: string): LicenseState {
  return { status: "none", tier: "free", ...(message ? { message } : {}) };
}

/**
 * Verify a licence key. Total: every input returns a state, including "" and garbage.
 *
 * `now` is a parameter rather than a Date.now() call so the expiry and grace behaviour is
 * testable without waiting fourteen days, and so a receipt can be recomputed for a past instant.
 */
export function verifyLicense(
  key: string | undefined,
  options: { now?: Date; issuerPublicKey?: string } = {},
): LicenseState {
  const raw = key?.trim();
  if (!raw) return freeTier();

  const body = raw.startsWith("kage_") ? raw.slice("kage_".length) : null;
  if (!body) return { status: "invalid", tier: "free", message: "A Kage licence key starts with kage_." };

  const [payloadPart, signaturePart, ...rest] = body.split(".");
  if (!payloadPart || !signaturePart || rest.length) {
    return { status: "invalid", tier: "free", message: "This licence key is malformed." };
  }

  const payloadBytes = base64urlToBuffer(payloadPart);
  const signature = base64urlToBuffer(signaturePart);
  if (!payloadBytes || !signature) {
    return { status: "invalid", tier: "free", message: "This licence key is malformed." };
  }

  const issuer = decodeIssuerKey(options.issuerPublicKey ?? ISSUER_PUBLIC_KEY_SPKI);
  if (!issuer) return freeTier();

  let verified = false;
  try {
    // Signature is checked over the EXACT bytes that were signed — the base64url payload segment,
    // not a re-serialization of the parsed object. Re-encoding JSON before verifying is how
    // signature checks quietly become no-ops when key order or whitespace differs.
    verified = edVerify(null, Buffer.from(payloadPart), issuer, signature);
  } catch {
    verified = false;
  }
  if (!verified) {
    return { status: "invalid", tier: "free", message: "This licence key's signature does not verify." };
  }

  let payload: LicensePayload;
  try {
    payload = JSON.parse(payloadBytes.toString("utf8")) as LicensePayload;
  } catch {
    return { status: "invalid", tier: "free", message: "This licence key's contents are unreadable." };
  }

  if (payload.tier !== "team" && payload.tier !== "free") {
    return { status: "invalid", tier: "free", message: `Unknown licence tier '${String(payload.tier)}'.` };
  }
  if (!Number.isInteger(payload.seats) || payload.seats < 1) {
    return { status: "invalid", tier: "free", message: "This licence key has no valid seat count." };
  }

  const now = options.now ?? new Date();
  if (payload.expires_at) {
    const expiry = Date.parse(payload.expires_at);
    if (Number.isNaN(expiry)) {
      return { status: "invalid", tier: "free", message: "This licence key has an unreadable expiry." };
    }
    const overdueMs = now.getTime() - expiry;
    if (overdueMs > 0) {
      const graceLeft = Math.ceil((GRACE_PERIOD_DAYS * DAY_MS - overdueMs) / DAY_MS);
      if (graceLeft > 0) {
        return {
          status: "grace",
          tier: payload.tier,
          payload,
          graceDaysLeft: graceLeft,
          message: `Licence expired ${payload.expires_at.slice(0, 10)}. Everything keeps working for ${graceLeft} more day${graceLeft === 1 ? "" : "s"}.`,
        };
      }
      return {
        status: "expired",
        tier: "free",
        payload,
        // Says precisely what was lost and what was NOT. Nobody loses a card over billing.
        message: `Licence expired ${payload.expires_at.slice(0, 10)}. Team features are off; every card you have is untouched and still recalled.`,
      };
    }
  }

  return { status: "active", tier: payload.tier, payload };
}

/**
 * Is a paid capability available? The single question the rest of the codebase asks.
 *
 * Grace counts as entitled — that is the entire point of a grace period, and a check that treated
 * it otherwise would turn a fortnight of goodwill into a fortnight of breakage.
 */
export function isEntitled(state: LicenseState): boolean {
  return (state.status === "active" || state.status === "grace") && state.tier === "team";
}

/**
 * Seat accounting, reported and never enforced.
 *
 * Kage cannot see a team's headcount — there is no server and no directory, only the distinct
 * approvers observed in a shadow store. Blocking the eleventh teammate on a ten-seat licence
 * would therefore mean blocking on a NUMBER KAGE CANNOT VERIFY, which is exactly the kind of
 * unmeasured claim the product refuses everywhere else. So this reports an overage for a human
 * to settle, and nothing anywhere acts on it.
 */
export function seatStatus(state: LicenseState, distinctApprovers: number): {
  seats: number | null;
  used: number;
  over: boolean;
  message?: string;
} {
  const seats = state.payload?.seats ?? null;
  if (seats === null || !isEntitled(state)) return { seats, used: distinctApprovers, over: false };
  const over = distinctApprovers > seats;
  return {
    seats,
    used: distinctApprovers,
    over,
    ...(over
      ? { message: `${distinctApprovers} people have approved cards on a ${seats}-seat licence. Nothing is blocked; add seats when convenient.` }
      : {}),
  };
}

/** One line for `kage status` / the app footer. Never alarming, never a nag. */
export function describeLicense(state: LicenseState): string {
  switch (state.status) {
    case "active":
      return `Team licence — ${state.payload?.seats} seat${state.payload?.seats === 1 ? "" : "s"}, issued to ${state.payload?.issued_to}.`;
    case "grace":
      return state.message ?? "Team licence — in grace period.";
    case "expired":
      return state.message ?? "Team licence expired. Solo features are unaffected.";
    case "invalid":
      return state.message ?? "Licence key not recognised. Running as solo.";
    default:
      return "Solo — free, and not a trial. Every card, every recall, no expiry.";
  }
}
