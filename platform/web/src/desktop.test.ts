import { describe, expect, test } from "vitest";
import { buildBrief, buildFreeFormBrief, desktop } from "./desktop";
import type { WorkDetailDto } from "./api/types";

function detail(overrides: Partial<WorkDetailDto> = {}): WorkDetailDto {
  return {
    work_id: "repo:x:proposal:limits",
    title: "Make tenantLimit configurable",
    body: "Let each tenant tune their own limit.",
    stage: "proposed",
    stored_stage: "proposed",
    claimed_by: null,
    blast_paths: ["src/limits.ts", "src/settings.tsx"],
    dependents: [],
    stage_log: [],
    evidence: [],
    weak_evidence: 0,
    estimate: { confidence: "none" } as WorkDetailDto["estimate"],
    knowledge: [{ title: "tenantLimit is 10 because the billing tier caps it", summary: "Billing enforces it." }],
    errors: [],
    ...overrides,
  };
}

describe("buildBrief", () => {
  test("the agent is told what the team already knows about the code it will touch", () => {
    const brief = buildBrief(detail());
    expect(brief.prompt).toContain("Make tenantLimit configurable");
    expect(brief.prompt).toContain("tenantLimit is 10 because the billing tier caps it");
    expect(brief.memories).toHaveLength(1);
  });

  // The grounding gate. An agent told about files nobody chose will edit files nobody agreed to
  // touch — the same rule the PRD drafter enforces on the other side of the plan.
  test("only the item's grounded files are named", () => {
    const brief = buildBrief(detail());
    expect(brief.prompt).toContain("src/limits.ts");
    expect(brief.prompt).toContain("src/settings.tsx");
    expect(brief.paths).toEqual(["src/limits.ts", "src/settings.tsx"]);
    expect(brief.prompt).not.toContain("src/billing/invoice.ts");
  });

  // The agent can read the repository itself. Sending source through the prompt spends the
  // context window on something that is free.
  test("no file contents are sent, only paths", () => {
    const brief = buildBrief(detail());
    expect(/export const|function \w+\(|import .* from/.test(brief.prompt)).toBe(false);
  });

  test("an ungrounded item says so rather than silently listing nothing", () => {
    const brief = buildBrief(detail({ blast_paths: [] }));
    expect(brief.prompt).toContain("(none recorded yet)");
    expect(brief.paths).toEqual([]);
  });

  test("with no memory the brief omits the section rather than claiming an empty one", () => {
    const brief = buildBrief(detail({ knowledge: [] }));
    expect(brief.prompt).not.toContain("What the team already knows");
    expect(brief.memories).toEqual([]);
  });

  test("an empty body does not produce a blank line where the intent should be", () => {
    const brief = buildBrief(detail({ body: "   " }));
    expect(brief.prompt).toContain("(no further description)");
  });

  // Memory is quoted as-is. If a claim is wrong the fix is to correct the memory, not to
  // paraphrase it here where nobody can see it happen.
  test("memory is quoted verbatim, never paraphrased", () => {
    const claim = "tenantLimit is 10 because the billing tier caps it";
    expect(buildBrief(detail()).prompt).toContain(claim);
  });

  test("the token estimate is present and scales with the prompt", () => {
    const small = buildBrief(detail({ knowledge: [] }));
    const large = buildBrief(
      detail({ knowledge: Array.from({ length: 20 }, (_, i) => ({ title: `fact ${i}`, summary: "x".repeat(80) })) }),
    );
    expect(large.tokens_est).toBeGreaterThan(small.tokens_est);
  });
});

// A repository with no derived work items had NO path to start an agent at all: the sheet's Start
// button required a selected work item, and the brief pane sat on "Assembling the brief…" forever —
// a spinner for something that was never going to arrive. That is the first thing a new user meets
// after adding their first repository, and it was a dead end.
describe("buildFreeFormBrief", () => {
  test("what you typed is exactly what is sent — the preview is a promise, not a summary", () => {
    const task = "Read src/limits.ts and say whether tenantLimit should become configurable.";
    expect(buildFreeFormBrief(task).prompt).toBe(task);
  });

  test("surrounding whitespace is trimmed, so a stray newline is not sent as the task", () => {
    expect(buildFreeFormBrief("  do the thing\n").prompt).toBe("do the thing");
  });

  // No work item means no blast paths, so there is no grounding to claim. Inventing a file list here
  // would tell the agent that somebody chose those files when nobody did.
  test("a free-form task claims no grounding and no pre-attached memory", () => {
    const brief = buildFreeFormBrief("anything");
    expect(brief.paths).toEqual([]);
    expect(brief.memories).toEqual([]);
  });

  test("the estimate still scales with what was typed", () => {
    expect(buildFreeFormBrief("x".repeat(400)).tokens_est).toBeGreaterThan(buildFreeFormBrief("x").tokens_est);
  });
});

describe("desktop()", () => {
  // The portal still ships in a browser, where none of this exists. Every caller must handle null
  // rather than assume the app is there.
  test("is null in a browser", () => {
    expect(desktop()).toBeNull();
  });
});
