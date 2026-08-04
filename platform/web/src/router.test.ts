import { describe, expect, test } from "vitest";
import { parseRoute, routeToPath, navLinks, navGroups, portalBase, withBase } from "./router";

describe("portal base mounting", () => {
  test("detects the /app mount from the pathname and is empty at root", () => {
    expect(portalBase("/")).toBe("");
    expect(portalBase("/overview")).toBe("");
    expect(portalBase("/app")).toBe("/app");
    expect(portalBase("/app/")).toBe("/app");
    expect(portalBase("/app/review")).toBe("/app");
  });

  test("withBase prefixes root-absolute portal links only when mounted under a base", () => {
    // At root the base is empty, so links are unchanged (this is why existing tests stay green).
    expect(withBase("/review", "")).toBe("/review");
    // Under /app the internal link is prefixed so a full-page navigation stays inside the portal.
    expect(withBase("/review", "/app")).toBe("/app/review");
    // Fragments and non-absolute links are never rewritten.
    expect(withBase("#main-content", "/app")).toBe("#main-content");
    expect(withBase("https://example.com", "/app")).toBe("https://example.com");
  });
});

describe("parseRoute", () => {
  // The landing page moved from Attention to Activity when the agents half finally got a surface.
  // Activity carries the most urgent decision inline, so opening on it does not hide the blocker —
  // which was the whole reason Attention led before.
  test("the root is Activity — the app opens on what the agents are doing", () => {
    expect(parseRoute("/")).toEqual({ page: "activity" });
    expect(parseRoute("/activity")).toEqual({ page: "activity" });
    expect(parseRoute("/attention")).toEqual({ page: "attention" });
    expect(parseRoute("/overview")).toEqual({ page: "overview" });
  });

  test("carries the system-map view, defaulting to feature", () => {
    expect(parseRoute("/system-map")).toEqual({ page: "system-map", view: "feature" });
    expect(parseRoute("/system-map?view=runtime")).toEqual({
      page: "system-map",
      view: "runtime",
    });
  });

  test("parses per-entity detail slugs", () => {
    expect(parseRoute("/features/checkout")).toEqual({
      page: "feature",
      slug: "checkout",
    });
    expect(parseRoute("/runbooks/rotate-keys")).toEqual({
      page: "runbook",
      slug: "rotate-keys",
    });
    expect(parseRoute("/decisions/adopt-okf")).toEqual({
      page: "decision",
      slug: "adopt-okf",
    });
    expect(parseRoute("/tasks/task-42")).toEqual({ page: "task", id: "task-42" });
  });

  test("parses the list and singleton pages", () => {
    expect(parseRoute("/features")).toEqual({ page: "features" });
    expect(parseRoute("/review")).toEqual({ page: "review" });
    expect(parseRoute("/settings")).toEqual({ page: "settings" });
  });

  test("parses the segregated admin diagnostics route", () => {
    expect(parseRoute("/admin/diagnostics")).toEqual({ page: "admin-diagnostics" });
    expect(routeToPath({ page: "admin-diagnostics" })).toBe("/admin/diagnostics");
  });

  test("unknown routes resolve to a not-found route carrying the path", () => {
    expect(parseRoute("/nope/here")).toEqual({ page: "not-found", path: "/nope/here" });
  });

  test("round-trips route to path", () => {
    expect(routeToPath({ page: "overview" })).toBe("/overview");
    expect(routeToPath({ page: "feature", slug: "checkout" })).toBe("/features/checkout");
    expect(routeToPath({ page: "system-map", view: "runtime" })).toBe(
      "/system-map?view=runtime",
    );
    expect(routeToPath({ page: "task", id: "task-42" })).toBe("/tasks/task-42");
  });
});

describe("navLinks", () => {
  test("declares the full information architecture, grouped, in order", () => {
    // Three nouns: what is happening NOW, the WORK it happens to, the MEMORY it produces.
    expect(navGroups.map((g) => g.label)).toEqual(["Now", "Work", "Memory"]);
    expect(navGroups[0].links.map((l) => l.label)).toEqual(["Activity", "Inbox", "Needs you"]);
    expect(navGroups[1].links.map((l) => l.label)).toEqual(["Board", "Receipts"]);
    expect(navLinks.map((l) => l.label)).toEqual([
      "Activity",
      // The Librarian's approval console. Added when capture moved from heuristics to a real
      // extraction pass: nothing becomes team knowledge without passing a human, so the queue
      // that human clears is a primary destination, not a detail on another page.
      "Inbox",
      "Needs you",
      "Board",
      // Receipts replaced Proof, and Knowledge now points at cards rather than the legacy entity
      // browser: both surfaces read the Librarian's store, which is the only memory the product
      // still writes. The old routes still resolve so a bookmark keeps working.
      "Receipts",
      "Knowledge",
      "System map",
      "Review",
    ]);
    expect(navLinks.length).toBe(8);
  });

  // A deliberate contract change, not a loosened test. What left the sidebar, and why:
  //   Agents + Agent Tasks  folded into Activity — an agent reaches a repository three ways
  //                         (launched here, finished with a receipt, observed elsewhere) and
  //                         three sidebar entries for one subject is not an architecture.
  //   Overview              folded into Proof — both showed the same measured value, in two
  //                         different visual languages.
  //   Billing, Integrations, Costs, Settings  deleted: each read nothing real.
  test("no sidebar entry survives that reads nothing real", () => {
    const labels = navLinks.map((l) => l.label);
    for (const gone of ["Agents", "Agent Tasks", "Overview", "Billing", "Integrations", "Costs", "Settings"]) {
      expect(labels).not.toContain(gone);
    }
  });

  test("every nav href parses back to a real (non not-found) route", () => {
    for (const link of navLinks) {
      expect(parseRoute(link.href).page).not.toBe("not-found");
    }
  });
});

describe("work item detail", () => {
  it("round-trips an id containing colons", () => {
    const id = "repo:https-github-com-kage-core-kage:proposal:make-tenantlimit-configurable-1785";
    expect(parseRoute(`/work/${encodeURIComponent(id)}`)).toEqual({ page: "work-item", id });
    // The round trip is the property that matters: work ids are colon-delimited, so a route
    // that encodes on the way out but not on the way in silently 404s every real item.
    expect(parseRoute(routeToPath({ page: "work-item", id }))).toEqual({ page: "work-item", id });
  });
});
