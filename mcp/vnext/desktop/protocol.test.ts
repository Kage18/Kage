import test from "node:test";
import assert from "node:assert/strict";

import { daemonOrigin, routeDesktopRequest, toPortalPath } from "./protocol.js";

function route(url: string, hasActiveRepo = true) {
  return routeDesktopRequest({ url, hasActiveRepo });
}

test("the portal's API calls are forwarded to the repository's daemon", () => {
  for (const path of ["/v2/attention", "/v2/work", "/kage/events", "/health"]) {
    const decision = route(`kage://app${path}`);
    assert.equal(decision.kind, "forward", `${path} must reach the daemon`);
  }
});

test("a forwarded request keeps its query string", () => {
  const decision = route("kage://app/v2/knowledge?kind=decision&limit=50");
  assert.equal(decision.kind, "forward");
  assert.equal(decision.kind === "forward" && decision.search, "?kind=decision&limit=50");
});

// The SPA is built with an absolute `/app/` base, so its own asset requests already arrive
// `/app`-rooted. Client-side routes arrive bare. One resolver has to handle both.
test("a bare client-side route is normalised to the /app root the portal is built for", () => {
  assert.equal(toPortalPath("/attention"), "/app/attention");
  assert.equal(toPortalPath("/decisions/some-slug"), "/app/decisions/some-slug");
  assert.equal(toPortalPath("/"), "/app/");
  assert.equal(toPortalPath(""), "/app/");
});

test("an already-rooted asset path is left alone, never doubled", () => {
  // The bug this prevents: `/app/app/assets/index.js`, which 404s and blanks the window.
  assert.equal(toPortalPath("/app/assets/index-61UM2hMv.js"), "/app/assets/index-61UM2hMv.js");
  assert.equal(toPortalPath("/app"), "/app");
  assert.equal(toPortalPath("/app/"), "/app/");
});

test("everything that is not an API call is served from the bundle", () => {
  const decision = route("kage://app/attention");
  assert.equal(decision.kind, "file");
  assert.equal(decision.kind === "file" && decision.pathname, "/app/attention");
});

// A custom scheme serving files off disk is exactly where traversal bites. The PROPERTY that must
// hold is "nothing can name a path outside the bundle" — asserted here rather than the mechanism,
// because there are two mechanisms and an earlier version of this test asserted the wrong one.
test("no request can name a path outside the bundle, encoded or not", () => {
  for (const attempt of [
    "kage://app/../../../../etc/passwd",
    "kage://app/app/assets/../../../../etc/passwd",
    "kage://app/%2e%2e%2f%2e%2e%2fetc/passwd",
    "kage://app/app/%2E%2E/%2E%2E/secret",
  ]) {
    const decision = route(attempt);
    if (decision.kind === "deny") continue; // caught outright
    assert.equal(decision.kind, "file", `${attempt} must never be forwarded`);
    assert.equal(
      decision.kind === "file" && decision.pathname.includes(".."),
      false,
      `${attempt} resolved to ${decision.kind === "file" ? decision.pathname : ""}, which still escapes`,
    );
  }
});

// The encoded form is the one a raw-string check would miss, so pin it exactly: `new URL()`
// normalises raw `../` and uppercase `%2E%2E` away by itself, but leaves lowercase `%2e%2e%2f`
// encoded. Decoding is therefore mandatory, not belt-and-braces.
test("lowercase encoded traversal survives URL parsing and is caught by the decoded check", () => {
  assert.equal(new URL("kage://app/%2e%2e%2fsecret").pathname.includes(".."), false, "parser leaves it encoded");
  const decision = route("kage://app/%2e%2e%2f%2e%2e%2fetc/passwd");
  assert.equal(decision.kind, "deny");
  assert.equal(decision.kind === "deny" && decision.reason, "path traversal");
});

// decodeURIComponent throws on a lone `%`. Unhandled, that takes out the request handler for the
// whole window — every subsequent asset request fails and the app renders blank.
test("a malformed percent-encoding is refused rather than thrown", () => {
  const decision = route("kage://app/100%");
  assert.equal(decision.kind, "deny");
  assert.equal(decision.kind === "deny" && decision.reason, "malformed percent-encoding");
});

// With no repository open there is no daemon port, so forwarding would hit a closed socket and
// surface as an opaque network error. Saying so is better than failing obscurely.
test("an API call with no repository open is refused in words, not left to fail on a dead port", () => {
  const decision = route("kage://app/v2/work", false);
  assert.equal(decision.kind, "deny");
  assert.equal(decision.kind === "deny" && decision.reason, "no repository is open");
});

test("with no repository open the shell itself still loads, so the empty state can render", () => {
  const decision = route("kage://app/", false);
  assert.equal(decision.kind, "file", "the first-run screen must be reachable with zero repos");
});

test("an unparseable url is refused rather than thrown", () => {
  const decision = route("not a url at all");
  assert.equal(decision.kind, "deny");
  assert.equal(decision.kind === "deny" && decision.reason, "unparseable request url");
});

// Loopback only. The app must never be able to proxy to a remote host.
test("forwarding always targets loopback", () => {
  assert.equal(daemonOrigin(3141), "http://127.0.0.1:3141");
  assert.match(daemonOrigin(3141), /^http:\/\/127\.0\.0\.1:/);
});
