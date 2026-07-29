// Typed HTTP client for the Kage vNext read-model API. The portal talks ONLY to the daemon that
// serves it (same origin, `connect-src 'self'` under the strict CSP), authenticated with the Phase A
// machine token as a Bearer header. Every method returns a DTO from the generated `types.ts`, so the
// wire shape is checked against the backend at build time.

import type {
  AttentionQueueDto,
  WorkBoardDto,
  ProofReportDto,
  WorkDetailDto,
  AgentsReportDto,
  AttentionActionResultDto,
  CommandResultDto, TeamReportDto,
  EntityDetailDto,
  EntityListDto,
  FeatureListDto,
  IntegrationsDto,
  OverviewDto,
  DecisionDetailDto,
  ReviewDecisionRequestDto,
  ReviewDecisionResultDto,
  ReviewItemsDto,
  RunbookDetailDto,
  SystemMapDto,
  SystemMapView,
  TaskDetailDto,
  TaskReceiptDto,
  TasksDto,
} from "./types";

/**
 * Backoff between retries: 250ms, 500ms, 1s, 2s — about 3.75s of patience in total, which covers a
 * cold daemon start without making a genuinely dead one feel hung.
 */
function delay(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
}

// The six authorized review mutations, as their URL action segments.
export type ReviewAction =
  | "accept"
  | "edit-and-accept"
  | "reject"
  | "supersede"
  | "assign"
  | "request-evidence";

// A review mutation's HTTP outcome. `status` is surfaced verbatim so the UI can explain a 403
// (self-approval blocked) or 409 (version conflict) against the offending item, never swallowing it.
export interface ReviewMutationOutcome {
  status: number;
  ok: boolean;
  error?: string;
  result?: ReviewDecisionResultDto;
}

export interface KageApiClient {
  teamReport(): Promise<{ report: TeamReportDto | null }>;
  overview(): Promise<OverviewDto>;
  systemMap(view?: SystemMapView, focus?: string | null): Promise<SystemMapDto>;
  features(): Promise<FeatureListDto>;
  components(): Promise<EntityListDto>;
  attention(): Promise<AttentionQueueDto>;
  work(options?: { knowledge?: boolean }): Promise<WorkBoardDto>;
  proof(): Promise<ProofReportDto>;
  workItem(id: string): Promise<WorkDetailDto>;
  agents(): Promise<AgentsReportDto>;
  reverify(ref: string, actor: string): Promise<AttentionActionResultDto>;
  command(input: { kind: string; work_id: string; actor: string; note?: string }): Promise<CommandResultDto>;
  /** One generic reader for the knowledge kinds surfaced under their own browse tabs. */
  knowledgeList(kind: string): Promise<EntityListDto>;
  knowledgeDetail(kind: string, slug: string): Promise<EntityDetailDto>;
  flows(): Promise<EntityListDto>;
  runbooks(): Promise<EntityListDto>;
  decisions(): Promise<EntityListDto>;
  feature(slug: string): Promise<EntityDetailDto>;
  component(slug: string): Promise<EntityDetailDto>;
  flow(slug: string): Promise<EntityDetailDto>;
  runbook(slug: string): Promise<RunbookDetailDto>;
  decision(slug: string): Promise<DecisionDetailDto>;
  reviewItems(status?: string): Promise<ReviewItemsDto>;
  decideReview(
    reviewItemId: string,
    action: ReviewAction,
    request: ReviewDecisionRequestDto,
  ): Promise<ReviewMutationOutcome>;
  tasks(): Promise<TasksDto>;
  task(taskId: string): Promise<TaskDetailDto>;
  taskReceipt(taskId: string): Promise<TaskReceiptDto>;
  integrations(): Promise<IntegrationsDto>;
}

export class KageApi implements KageApiClient {
  // Explicit fields (not constructor parameter properties): the portal tsconfig sets
  // `erasableSyntaxOnly`, which forbids parameter-property syntax because it is not type-erasable.
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  /**
   * A read, with a bounded retry on the failures that mean "not ready yet" rather than "wrong".
   *
   * This exists because of a real dead end: in the desktop app the daemon is started by the app
   * itself, and on a cold repository it can take longer to accept connections than the window
   * takes to load. The first `/v2/overview` then failed, and with no retry the window sat on
   * "Loading repository knowledge…" FOREVER — while the daemon answered that same request in
   * 0.13s a second later. Only relaunching the app cleared it.
   *
   * Retried: a network error (nothing listening yet) and 502/503/504 (the app's protocol handler
   * reports a daemon that is not answering as 502, and "no repository is open" as 503). NOT
   * retried: 4xx, which means the request itself is wrong and will be just as wrong next time.
   */
  async get<T>(path: string, attempt = 0): Promise<T> {
    const RETRYABLE = new Set([502, 503, 504]);
    const MAX_ATTEMPTS = 5;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        headers: { authorization: `Bearer ${this.token}` },
      });
    } catch (error) {
      // Nothing listening yet. This is the common case while a daemon is still starting.
      if (attempt >= MAX_ATTEMPTS - 1) throw error;
      await delay(attempt);
      return this.get<T>(path, attempt + 1);
    }

    if (!response.ok) {
      if (RETRYABLE.has(response.status) && attempt < MAX_ATTEMPTS - 1) {
        await delay(attempt);
        return this.get<T>(path, attempt + 1);
      }
      throw new Error(`Kage API ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  overview(): Promise<OverviewDto> {
    return this.get<OverviewDto>("/v2/overview");
  }

  teamReport(): Promise<{ report: TeamReportDto | null }> {
    return this.get<{ report: TeamReportDto | null }>("/v2/team-report");
  }

  systemMap(view?: SystemMapView, focus?: string | null): Promise<SystemMapDto> {
    const params = new URLSearchParams();
    if (view) params.set("view", view);
    if (focus) params.set("focus", focus);
    const query = params.toString();
    return this.get<SystemMapDto>(`/v2/system-map${query ? `?${query}` : ""}`);
  }

  features(): Promise<FeatureListDto> {
    return this.get<FeatureListDto>("/v2/features");
  }

  components(): Promise<EntityListDto> {
    return this.get<EntityListDto>("/v2/components");
  }

  attention(): Promise<AttentionQueueDto> {
    return this.get<AttentionQueueDto>("/v2/attention");
  }

  work(options: { knowledge?: boolean } = {}): Promise<WorkBoardDto> {
    // Skipping knowledge avoids one recall + risk report per card — measured at ~4.8s each, so a
    // five-card board goes from ~21s to ~2.5s. The work item detail still carries the full brief,
    // so a caller that only needs the list loses nothing.
    return this.get<WorkBoardDto>(options.knowledge === false ? "/v2/work?knowledge=0" : "/v2/work");
  }

  proof(): Promise<ProofReportDto> {
    return this.get<ProofReportDto>("/v2/proof");
  }

  workItem(id: string): Promise<WorkDetailDto> {
    return this.get<WorkDetailDto>(`/v2/work/${encodeURIComponent(id)}`);
  }

  agents(): Promise<AgentsReportDto> {
    return this.get<AgentsReportDto>("/v2/agents");
  }

  // A refusal (409) is a RESULT the operator needs to read — reverify declines to
  // rubber-stamp a packet whose cited code is gone — so it is returned, not thrown.
  async reverify(ref: string, actor: string): Promise<AttentionActionResultDto> {
    const response = await fetch(`${this.baseUrl}/v2/attention/reverify`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
      body: JSON.stringify({ ref, actor }),
    });
    return (await response.json()) as AttentionActionResultDto;
  }

  // The command loop: the app never mutates state, it issues a decision. The response
  // carries the re-derived board and queue so the UI shows the consequence, not a guess.
  async command(input: { kind: string; work_id: string; actor: string; note?: string }): Promise<CommandResultDto> {
    const response = await fetch(`${this.baseUrl}/v2/commands`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
      body: JSON.stringify(input),
    });
    const body = (await response.json()) as CommandResultDto;
    if (!response.ok) return { ok: false, error: body.error ?? `command failed (${response.status})` };
    return body;
  }

  knowledgeList(kind: string): Promise<EntityListDto> {
    return this.get<EntityListDto>(`/v2/${kind}`);
  }

  knowledgeDetail(kind: string, slug: string): Promise<EntityDetailDto> {
    return this.get<EntityDetailDto>(`/v2/${kind}/${encodeURIComponent(slug)}`);
  }

  flows(): Promise<EntityListDto> {
    return this.get<EntityListDto>("/v2/flows");
  }

  runbooks(): Promise<EntityListDto> {
    return this.get<EntityListDto>("/v2/runbooks");
  }

  decisions(): Promise<EntityListDto> {
    return this.get<EntityListDto>("/v2/decisions");
  }

  feature(slug: string): Promise<EntityDetailDto> {
    return this.get<EntityDetailDto>(`/v2/features/${encodeURIComponent(slug)}`);
  }

  component(slug: string): Promise<EntityDetailDto> {
    return this.get<EntityDetailDto>(`/v2/components/${encodeURIComponent(slug)}`);
  }

  flow(slug: string): Promise<EntityDetailDto> {
    return this.get<EntityDetailDto>(`/v2/flows/${encodeURIComponent(slug)}`);
  }

  runbook(slug: string): Promise<RunbookDetailDto> {
    return this.get<RunbookDetailDto>(`/v2/runbooks/${encodeURIComponent(slug)}`);
  }

  decision(slug: string): Promise<DecisionDetailDto> {
    return this.get<DecisionDetailDto>(`/v2/decisions/${encodeURIComponent(slug)}`);
  }

  reviewItems(status?: string): Promise<ReviewItemsDto> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.get<ReviewItemsDto>(`/v2/review-items${query}`);
  }

  // A review mutation. Unlike `get`, a non-2xx status is NOT thrown away as a generic error: the
  // status and error code are returned so the caller can explain a 403/409 against the item. The
  // portal talks only to the same origin under the strict CSP (`connect-src 'self'`).
  async decideReview(
    reviewItemId: string,
    action: ReviewAction,
    request: ReviewDecisionRequestDto,
  ): Promise<ReviewMutationOutcome> {
    const response = await fetch(
      `${this.baseUrl}/v2/review-items/${encodeURIComponent(reviewItemId)}/${action}`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
        body: JSON.stringify(request),
      },
    );
    const body = (await response.json().catch(() => null)) as
      | (ReviewDecisionResultDto & { error?: string })
      | { error?: string }
      | null;
    if (response.ok) {
      return { status: response.status, ok: true, result: (body ?? undefined) as ReviewDecisionResultDto };
    }
    return { status: response.status, ok: false, error: body?.error ?? "request_failed" };
  }

  tasks(): Promise<TasksDto> {
    return this.get<TasksDto>("/v2/tasks");
  }

  task(taskId: string): Promise<TaskDetailDto> {
    return this.get<TaskDetailDto>(`/v2/tasks/${encodeURIComponent(taskId)}`);
  }

  taskReceipt(taskId: string): Promise<TaskReceiptDto> {
    return this.get<TaskReceiptDto>(`/v2/tasks/${encodeURIComponent(taskId)}/receipt`);
  }

  integrations(): Promise<IntegrationsDto> {
    return this.get<IntegrationsDto>("/v2/integrations");
  }
}
