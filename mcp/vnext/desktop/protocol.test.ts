import test from "node:test";
import assert from "node:assert/strict";

import { daemonOrigin, routeDesktopRequest, toPortalPath } from "./protocol.js";

function route(url: string, hasActiveRepo = true) {
  return routeDesktopRequest({ url, hasActiveRepo });
}

test("the portal's API calls are forwarded to the repository's daemon", () => {
  for (const path of ["/v2/attention", "/v2/work", "/health"]) {
    const decision = route(`kage://app${path}`);
    assert.equal(decision.kind, "forward", `${path} must reach the daemon`);
  }
});

// THE bug this rule exists to prevent, measured on a running app rather than reasoned about:
// forwarding the SSE feed through the scheme leaked one of Electron's ~6-per-host sockets on every
// EventSource reconnect, because `net.fetch` of an endpoint that never ends is never released.
// After six reconnects the pool was exhausted and every other request queued indefinitely — the
// log showed requests started and never completed, and lsof showed exactly 6 established sockets.
// That was "the pages take ages to load".
test("the live feed is never forwarded — a stream would leak a socket per reconnect", () => {
  const decision = route("kage://app/kage/events");
  assert.equal(decision.kind, "deny", "forwarding this exhausts the connection pool");
  assert.match(decision.kind === "deny" ? decision.reason : "", /IPC/);
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

// The packaging guard, and it is not theoretical: the first packaged build died on launch with
// "Cannot find module 'typescript'" because the desktop shell required `daemon.js`, which requires
// `kernel.js`, which requires typescript — and the app bundles mcp/dist WITHOUT node_modules. It
// worked perfectly from a source checkout, which is exactly why only launching the real bundle
// caught it. Same class of fault as the 4.0.0 portal that 404'd for every npm user.
//
// So: everything the shell loads must resolve with node builtins alone.
// The FIRST version of this test checked only `vnext/desktop/*.js` and passed while the packaged
// app was silently broken: the dispatcher dynamically imports the orchestrator, which imports
// `kernel.js`, which requires `typescript` and `web-tree-sitter`. In the packaged app every derived
// route — attention, board, proof — therefore 503'd, and the UI degraded to empty bands that looked
// like "nothing to show" rather than "this failed". Checking one directory was checking the wrong
// thing; what matters is the transitive closure the worker actually reaches.
test("every module the worker can reach resolves, or its dependency is bundled", async () => {
  const { readFileSync, existsSync } = await import("node:fs");
  const { join, dirname, resolve } = await import("node:path");

  // Walked from the dispatcher outward, following relative requires, exactly as the worker does.
  const root = resolve(__dirname, "..", "..");
  const seen = new Set<string>();
  const bare = new Map<string, string>();
  const queue = [join(__dirname, "api-dispatch.js")];

  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    // BOTH forms. The compiler emits `require()` for static imports and keeps native
    // `import()` for dynamic ones — the dispatcher uses dynamic imports throughout, so a
    // require-only matcher walks nothing and passes vacuously. That is exactly how the first
    // version of this guard passed while the packaged app was broken.
    for (const match of source.matchAll(/(?:require|import)\("([^"]+)"\)/g)) {
      const spec = match[1];
      if (spec.startsWith("node:")) continue;
      if (spec.startsWith(".")) {
        queue.push(resolve(dirname(file), spec));
        continue;
      }
      bare.set(spec, file.slice(root.length + 1));
    }
  }

  assert.ok(seen.size > 5, "the walk must actually reach the orchestrator, not stop at the entry");

  // Anything third-party must either be SHIPPED or be genuinely optional.
  //
  // Shipped: listed in the desktop app's extraResources, which electron-builder copies into
  // Resources/kage/node_modules. Miss one and the packaged app 503s that whole route.
  const BUNDLED = new Set(["typescript", "web-tree-sitter"]);
  // Optional: imported inside a try/catch that degrades with a stated message, and not installed
  // by default. `@xenova/transformers` is the local-embeddings backend — absent, recall falls back
  // rather than failing, so shipping 100+ MB for it would be paying for nothing.
  const OPTIONAL = new Set(["@xenova/transformers"]);

  for (const [spec, from] of bare) {
    const pkg = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
    if (OPTIONAL.has(pkg)) continue;
    assert.ok(
      BUNDLED.has(pkg),
      `${from} requires "${pkg}", which the packaged app does not ship — add it to extraResources in platform/desktop/package.json`,
    );
  }
});

test("the desktop modules themselves pull no third-party dependency", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const { join } = await import("node:path");

  // The COMPILED output is what the app requires, so that is what is inspected.
  const here = __dirname;
  const compiled = readdirSync(here).filter((name) => name.endsWith(".js") && !name.endsWith(".test.js"));
  assert.ok(compiled.length >= 5, "the desktop core should have several compiled modules");

  for (const name of compiled) {
    const source = readFileSync(join(here, name), "utf8");
    for (const match of source.matchAll(/require\("([^"]+)"\)/g)) {
      const specifier = match[1];
      const bare = !specifier.startsWith(".") && !specifier.startsWith("node:");
      assert.equal(bare, false, `${name} requires "${specifier}" — the packaged app has no node_modules`);
    }
  }
});
