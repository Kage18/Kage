import { afterEach, describe, expect, test, vi } from "vitest";
import { KageApi } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

function ok(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function status(code: number): Response {
  return { ok: false, status: code, json: async () => ({}) } as unknown as Response;
}

/** A fetch that returns the queued responses in order, throwing entries that are Errors. */
function fetchReturning(...queued: Array<Response | Error>) {
  const calls: string[] = [];
  const fn = vi.fn(async (url: string) => {
    calls.push(url);
    const next = queued.shift();
    if (next instanceof Error) throw next;
    return next ?? ok({});
  });
  vi.stubGlobal("fetch", fn);
  return { calls };
}

describe("reads retry the failures that mean 'not ready', and only those", () => {
  // THE dead end this exists to prevent, and it was real: in the desktop app the daemon is started
  // by the app itself, and on a cold repository it can take longer to accept connections than the
  // window takes to load. The first /v2/overview failed, and with no retry the window sat on
  // "Loading repository knowledge…" forever — while the daemon answered that same request in 0.13s
  // a second later. Only relaunching cleared it.
  test("a daemon that is not listening yet is waited for, not given up on", async () => {
    const { calls } = fetchReturning(new TypeError("Failed to fetch"), ok({ repository: null }));
    const api = new KageApi("", "");
    await expect(api.overview()).resolves.toEqual({ repository: null });
    expect(calls).toHaveLength(2);
  });

  test("502 and 503 are retried — the app reports a starting daemon as exactly those", async () => {
    for (const code of [502, 503, 504]) {
      const { calls } = fetchReturning(status(code), ok({ ok: true }));
      await expect(new KageApi("", "").overview()).resolves.toEqual({ ok: true });
      expect(calls, `${code} must be retried`).toHaveLength(2);
    }
  });

  // A 4xx means the request itself is wrong and will be just as wrong next time. Retrying it would
  // turn a clear error into a slow one.
  test("a 404 fails immediately rather than being retried", async () => {
    const { calls } = fetchReturning(status(404));
    await expect(new KageApi("", "").overview()).rejects.toThrow("Kage API 404");
    expect(calls).toHaveLength(1);
  });

  test("a 403 fails immediately too", async () => {
    const { calls } = fetchReturning(status(403));
    await expect(new KageApi("", "").work()).rejects.toThrow("Kage API 403");
    expect(calls).toHaveLength(1);
  });

  // Patience is bounded: a genuinely dead daemon must surface as an error, not hang.
  test("retries give up and report the failure rather than retrying forever", async () => {
    const { calls } = fetchReturning(
      status(503), status(503), status(503), status(503), status(503), status(503),
    );
    await expect(new KageApi("", "").overview()).rejects.toThrow("Kage API 503");
    expect(calls.length).toBeLessThanOrEqual(5);
  });

  test("a request that succeeds first time is not retried", async () => {
    const { calls } = fetchReturning(ok({ items: [] }));
    await new KageApi("", "").attention();
    expect(calls).toHaveLength(1);
  });

  test("the retried request is the same one, not a different path", async () => {
    const { calls } = fetchReturning(status(503), ok({ items: [] }));
    await new KageApi("", "").work({ knowledge: false });
    expect(calls).toEqual(["/v2/work?knowledge=0", "/v2/work?knowledge=0"]);
  });
});
