import { useCallback, useEffect, useState } from "react";
import type { KageApiClient } from "./api/client";
import type { TeamReportDto,
  AttentionItemDto,
  AttentionQueueDto,
  WorkBoardDto,
  ProofReportDto,
  WorkDetailDto,
  AgentsReportDto,
  DecisionDetailDto,
  EntityDetailDto,
  EntityListDto,
  IntegrationDto,
  OverviewDto,
  ReviewItemDto,
  RunbookDetailDto,
  SystemMapDto,
  SystemMapView,
  TaskReceiptDto,
  TaskSummaryDto,
  TasksDto,
} from "./api/types";
import { AppShell } from "./components/AppShell";
import { AdminDiagnosticsPage } from "./pages/AdminDiagnosticsPage";
import { AgentTasksPage } from "./pages/AgentTasksPage";
import { BillingPage } from "./pages/BillingPage";
import { DecisionPage } from "./pages/DecisionPage";
import { EntityListPage } from "./pages/EntityListPage";
import { AttentionPage } from "./pages/AttentionPage";
import { ProofPage } from "./pages/ProofPage";
import { WorkItemPage } from "./pages/WorkItemPage";
import { AgentsPage } from "./pages/AgentsPage";
import { ActivityPage } from "./pages/ActivityPage";
import { KnowledgePage, type KnowledgeKind } from "./pages/KnowledgePage";
import { WORK_CHANGED_EVENT } from "./components/LiveIndicator";
import { WorkPage } from "./pages/WorkPage";
import { FeaturePage } from "./pages/FeaturePage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { OverviewPage } from "./pages/OverviewPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ReviewQueuePage, type ReviewDecisionInput, type ReviewMutationFeedback } from "./pages/ReviewQueuePage";
import { RunbookPage } from "./pages/RunbookPage";
import { SystemMapPage } from "./pages/SystemMapPage";
import { TaskReceiptPage } from "./pages/TaskReceiptPage";
import { navigateTo, routeToPath, useRoute, withBase, type Route } from "./router";

// The portal root. It resolves the current route from history, loads the repository overview once,
// and hosts every page inside the accessible AppShell. The shell (skip link, banner, primary
// navigation landmark, main region) is present in every state — including loading — so keyboard and
// assistive-tech users always have the same structure. Per-section pages arrive in Task 4+; for now
// unimplemented sections render an honest placeholder rather than pretending to have data.

type LoadState =
  | { status: "loading" }
  | { status: "ready"; overview: OverviewDto }
  | { status: "error"; message: string };

export interface AppProps {
  api: KageApiClient;
}

// A fresh install has nothing measured yet: no metrics, no integrations. In that case we guide the
// operator through local onboarding rather than showing an empty overview that implies success.
function needsOnboarding(overview: OverviewDto): boolean {
  return overview.metrics.length === 0 && overview.integrations.length === 0;
}

function NotFoundPage({ path }: { path: string }): React.ReactElement {
  return (
    <section aria-label="Page not found">
      <h1>Page not found</h1>
      <p className="muted">
        No portal section matches <code>{path}</code>.
      </p>
      <p>
        <a href={withBase("/overview")}>Return to Overview</a>
      </p>
    </section>
  );
}

// Loads the system map for the current view and hosts the interactive page. The map is fetched
// lazily (only when the System Map section is open) and re-fetched when the view or focus changes,
// so it NEVER sits on the context-delivery critical path. Switching views navigates the URL (which
// resets focus); expanding a node sets a focus that re-roots the two-hop window in place.
// T5 — lazy team-value loader (lead dashboard + IC injection transparency). Fetched only when the
// overview is open, never on the context-delivery critical path; a fetch failure renders the
// panel's honest unavailable state (null), never a fake healthy report.
// The Overview route. It needs BOTH the overview DTO (already loaded by App) and the value ledger
// (fetched here), because the redesigned page leads with the measured ledger value and shows the
// overview's provider-cost metrics beneath it. The ledger is fetched lazily and the page renders as
// soon as the overview is present; a null ledger renders an honest "could not assemble" line, never a
// blank hero.
function OverviewContainer({ api, overview }: { api: KageApiClient; overview: OverviewDto }): React.ReactElement {
  const [report, setReport] = useState<TeamReportDto | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    api
      .teamReport()
      .then((body) => {
        if (!cancelled) setReport(body.report);
      })
      .catch(() => {
        if (!cancelled) setReport(null);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);
  // `undefined` = still loading the ledger; render the page with report=null only once we know.
  return <OverviewPage overview={overview} report={report === undefined ? null : report} />;
}

function SystemMapContainer({
  api,
  view,
}: {
  api: KageApiClient;
  view: SystemMapView;
}): React.ReactElement {
  const [focus, setFocus] = useState<string | null>(null);
  const [state, setState] = useState<
    { status: "loading" } | { status: "ready"; map: SystemMapDto } | { status: "error"; message: string }
  >({ status: "loading" });

  // A new view arrives via the URL; clear any focus so the reader starts from the whole view.
  useEffect(() => {
    setFocus(null);
  }, [view]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    api
      .systemMap(view, focus)
      .then((map) => {
        if (!cancelled) setState({ status: "ready", map });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: "error", message: error instanceof Error ? error.message : "Unknown error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api, view, focus]);

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite">
        Loading system map…
      </p>
    );
  }
  if (state.status === "error") {
    return <p role="alert">The system map is unavailable: {state.message}</p>;
  }
  return (
    <SystemMapPage
      model={state.map}
      onSelectView={(next) => navigateTo({ page: "system-map", view: next })}
      onFocus={(entityId) => setFocus(entityId)}
      onClearFocus={() => setFocus(null)}
    />
  );
}

// A generic loader for a single knowledge entity fetched by slug. It fetches lazily (only when the
// detail route is open) and re-fetches when the slug changes, so detail pages never sit on the
// context-delivery critical path. Loading and error states are explicit and accessible.
function DetailContainer<T>({
  slug,
  label,
  load,
  render,
}: {
  slug: string;
  label: string;
  load: (slug: string) => Promise<T>;
  render: (data: T) => React.ReactElement;
}): React.ReactElement {
  const [state, setState] = useState<
    { status: "loading" } | { status: "ready"; data: T } | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    load(slug)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // `load` is derived from the stable `api` + `label`; keying on (slug, label) re-fetches when the
    // entity or its type changes without looping on the inline loader's per-render identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, label]);

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite">
        Loading {label}…
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p role="alert">
        This {label} is unavailable: {state.message}
      </p>
    );
  }
  return render(state.data);
}

// Loads the open review queue and hosts the review UX. Decisions POST through the mutating client
// method; a 403/409 is surfaced against the offending item (never swallowed), and a successful
// decision re-fetches so the queue reflects the new state. The acting identity is trust-on-assertion
// in the local single-user model: an "Acting as" input lets the operator assert who they are, and
// every mutation is attributed to that actor. This surface is entirely off the context-delivery path.
function ReviewQueueContainer({ api }: { api: KageApiClient }): React.ReactElement {
  const [actor, setActor] = useState("local-operator");
  const [items, setItems] = useState<ReviewItemDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ReviewMutationFeedback | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    api
      .reviewItems("open")
      .then((response) => {
        if (!cancelled) setItems(response.review_items);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unknown error");
      });
    return () => {
      cancelled = true;
    };
  }, [api, reloadKey]);

  const onDecide = useCallback(
    (item: ReviewItemDto, decision: ReviewDecisionInput) => {
      setFeedback(null);
      const { action, ...request } = decision;
      api
        .decideReview(item.review_item_id, action, request)
        .then((outcome) => {
          if (outcome.ok) {
            // The decision landed; re-fetch so the queue reflects the mutated state.
            setReloadKey((key) => key + 1);
          } else {
            setFeedback({ review_item_id: item.review_item_id, status: outcome.status, error: outcome.error });
          }
        })
        .catch((caught: unknown) => {
          setFeedback({
            review_item_id: item.review_item_id,
            status: 0,
            error: caught instanceof Error ? caught.message : "request_failed",
          });
        });
    },
    [api],
  );

  return (
    <div className="review-container">
      {items === null && error === null && (
        <p role="status" aria-live="polite">
          Loading the review queue…
        </p>
      )}
      {error !== null && <p role="alert">The review queue is unavailable: {error}</p>}
      {items !== null && (
        <ReviewQueuePage items={items} actor={actor} onActorChange={setActor} onDecide={onDecide} lastResult={feedback} />
      )}
    </div>
  );
}

// Loads the list of agent tasks Kage holds receipts for. Fetched lazily (only when the Agent Tasks
// or Costs section is open) so it never sits on the context-delivery critical path.
function AgentTasksContainer({ api }: { api: KageApiClient }): React.ReactElement {
  const [state, setState] = useState<
    { status: "loading" } | { status: "ready"; tasks: TasksDto } | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    api
      .tasks()
      .then((tasks) => {
        if (!cancelled) setState({ status: "ready", tasks });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: "error", message: error instanceof Error ? error.message : "Unknown error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite">
        Loading agent tasks…
      </p>
    );
  }
  if (state.status === "error") {
    return <p role="alert">Agent tasks are unavailable: {state.message}</p>;
  }
  return <AgentTasksPage tasks={state.tasks.tasks} />;
}

// Loads a browse-list of one entity kind (Components, Flows, Runbooks, Decisions, Features) and renders
// it. Fetched lazily when its tab opens. `load` picks the right client method; `section` is the URL
// segment its cards link to. These replace the former "arrives in a later Phase C task" placeholders.
// Human labels for the knowledge browse tabs, kept beside the dispatch that uses them.
const KNOWLEDGE_LABELS: Record<string, string> = {
  contracts: "Contracts",
  "data-models": "Data Models",
  invariants: "Invariants",
  incidents: "Incidents",
  documents: "Documents",
};

// The command loop lives here: a click becomes a command, the response carries the
// re-derived board, and the UI renders the consequence rather than an optimistic guess.
function WorkContainer({ api }: { api: KageApiClient }): React.ReactElement {
  const [board, setBoard] = useState<WorkBoardDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [actor, setActor] = useState("local-operator");

  const reload = useCallback(() => {
    api.work()
      .then((next: WorkBoardDto) => setBoard(next))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, [api]);
  useEffect(reload, [reload]);
  // Someone else claiming an item is exactly what a stale board hides, so re-derive on it.
  useLiveRefresh(reload);

  const runCommand = useCallback((kind: string, workId: string) => {
    setPending(workId);
    setError(null);
    api.command({ kind, work_id: workId, actor })
      .then((result) => {
        // A refused command (self-approval, unknown item) is reported verbatim: the gate
        // did its job, and hiding the reason would teach the operator nothing.
        if (!result.ok) { setError(result.error ?? "command refused"); return; }
        if (result.work) setBoard(result.work);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setPending(null));
  }, [api, actor]);

  if (error && !board) return <p className="empty-state">Work board unavailable: {error}</p>;
  if (!board) return <p className="empty-state">Deriving…</p>;
  return (
    <WorkPage
      board={board}
      actor={actor}
      onActorChange={setActor}
      onCommand={runCommand}
      pending={pending}
      error={error}
    />
  );
}

// A live decision anywhere — CLI, agent, teammate — should reach every open view. Containers
// subscribe to the shell's broadcast rather than each opening their own EventSource, so one
// connection serves the whole app.
function useLiveRefresh(reload: () => void): void {
  useEffect(() => {
    const handler = (): void => reload();
    window.addEventListener(WORK_CHANGED_EVENT, handler);
    return () => window.removeEventListener(WORK_CHANGED_EVENT, handler);
  }, [reload]);
}

function AttentionContainer({ api }: { api: KageApiClient }): React.ReactElement {
  const [state, setState] = useState<{ items: AttentionItemDto[] | null; error: string | null }>({ items: null, error: null });
  const reload = useCallback(() => {
    api.attention()
      .then((queue: AttentionQueueDto) => setState({ items: queue.items, error: null }))
      .catch((error: unknown) => setState({ items: null, error: error instanceof Error ? error.message : String(error) }));
  }, [api]);
  useEffect(reload, [reload]);
  useLiveRefresh(reload);
  if (state.error) return <p className="empty-state">Attention queue unavailable: {state.error}</p>;
  if (state.items === null) return <p className="empty-state">Deriving…</p>;
  return (
    <AttentionPage
      items={state.items}
      onReverify={(ref) =>
        api.reverify(ref, "portal").then((result) => {
          // The re-derived queue comes back with the response, so the row that was just
          // resolved disappears without a second round trip.
          if (result.attention) setState({ items: result.attention, error: null });
          return result;
        })
      }
    />
  );
}

// Loads every knowledge kind at once so the chips can carry real counts and a search can span
// all of them. Ten small parallel reads on a local daemon, and the alternative — loading only
// the selected kind — is what made the old ten-tab IA feel like ten separate products.
const KNOWLEDGE_KINDS: Array<{ kind: string; label: string }> = [
  { kind: "features", label: "Features" },
  { kind: "components", label: "Components" },
  { kind: "flows", label: "Flows" },
  { kind: "runbooks", label: "Runbooks" },
  { kind: "decisions", label: "Decisions" },
  { kind: "contracts", label: "Contracts" },
  { kind: "data-models", label: "Data Models" },
  { kind: "invariants", label: "Invariants" },
  { kind: "incidents", label: "Incidents" },
  { kind: "documents", label: "Documents" },
];

function KnowledgeContainer({ api, kind }: { api: KageApiClient; kind: string }): React.ReactElement {
  const [kinds, setKinds] = useState<KnowledgeKind[]>(
    KNOWLEDGE_KINDS.map((k) => ({ ...k, list: null, count: null })),
  );
  const [selected, setSelected] = useState(kind);

  useEffect(() => { setSelected(kind); }, [kind]);

  useEffect(() => {
    let live = true;
    for (const entry of KNOWLEDGE_KINDS) {
      const load = entry.kind === "features"
        ? api.features().then((f) => ({ kind: "feature", entities: f.features }) as EntityListDto)
        : api.knowledgeList(entry.kind);
      load
        .then((list) => {
          if (!live) return;
          setKinds((prev) => prev.map((k) =>
            k.kind === entry.kind ? { ...k, list, count: list.entities.length } : k));
        })
        // A kind that fails to load reports zero rather than hanging on "…" forever; the
        // others still render, because one bad kind must not blank the page.
        .catch(() => {
          if (!live) return;
          setKinds((prev) => prev.map((k) => (k.kind === entry.kind ? { ...k, count: 0 } : k)));
        });
    }
    return () => { live = false; };
  }, [api]);

  const select = useCallback((next: string) => {
    setSelected(next);
    const path = next === "all" ? "/knowledge" : `/knowledge?kind=${encodeURIComponent(next)}`;
    window.history.pushState({}, "", withBase(path));
  }, []);

  return <KnowledgePage kinds={kinds} selected={selected} onSelect={select} />;
}

// Activity, the landing screen. It joins three independent feeds — what needs a human, what
// finished, and which agents have been observed at all — because agents reach a repository three
// ways and a home screen that shows one of them is lying by omission.
//
// Each feed fails on its own: a missing agents report empties one band rather than blanking the
// page. Running sessions arrive from the desktop app over IPC and are absent in the browser, where
// the band states what would put something in it.
function ActivityContainer({ api }: { api: KageApiClient }): React.ReactElement {
  const [attention, setAttention] = useState<AttentionItemDto[]>([]);
  const [tasks, setTasks] = useState<TaskSummaryDto[]>([]);
  const [agents, setAgents] = useState<AgentsReportDto | null>(null);

  const reload = useCallback(() => {
    api.attention().then((queue: AttentionQueueDto) => setAttention(queue.items)).catch(() => setAttention([]));
    api.tasks().then((body: TasksDto) => setTasks(body.tasks)).catch(() => setTasks([]));
    api.agents().then((report: AgentsReportDto) => setAgents(report)).catch(() => setAgents(null));
  }, [api]);

  useEffect(reload, [reload]);
  useLiveRefresh(reload);

  return <ActivityPage attention={attention} tasks={tasks} agents={agents} />;
}

function AgentsContainer({ api }: { api: KageApiClient }): React.ReactElement {
  const [state, setState] = useState<{ report: AgentsReportDto | null; error: string | null }>({ report: null, error: null });
  useEffect(() => {
    let live = true;
    api.agents()
      .then((report: AgentsReportDto) => { if (live) setState({ report, error: null }); })
      .catch((error: unknown) => { if (live) setState({ report: null, error: error instanceof Error ? error.message : String(error) }); });
    return () => { live = false; };
  }, [api]);
  if (state.error) return <p className="empty-state">Agents unavailable: {state.error}</p>;
  if (!state.report) return <p className="empty-state">Reading sessions…</p>;
  return <AgentsPage report={state.report} />;
}

function WorkItemContainer({ api, id }: { api: KageApiClient; id: string }): React.ReactElement {
  const [state, setState] = useState<{ detail: WorkDetailDto | null; error: string | null }>({ detail: null, error: null });
  useEffect(() => {
    let live = true;
    setState({ detail: null, error: null });
    api.workItem(id)
      .then((detail: WorkDetailDto) => { if (live) setState({ detail, error: null }); })
      .catch((error: unknown) => { if (live) setState({ detail: null, error: error instanceof Error ? error.message : String(error) }); });
    return () => { live = false; };
  }, [api, id]);
  if (state.error) return <p className="empty-state">Work item unavailable: {state.error}</p>;
  if (!state.detail) return <p className="empty-state">Deriving…</p>;
  return <WorkItemPage detail={state.detail} />;
}

function ProofContainer({ api }: { api: KageApiClient }): React.ReactElement {
  const [state, setState] = useState<{ report: ProofReportDto | null; error: string | null }>({ report: null, error: null });
  useEffect(() => {
    let live = true;
    api.proof()
      .then((report: ProofReportDto) => { if (live) setState({ report, error: null }); })
      .catch((error: unknown) => { if (live) setState({ report: null, error: error instanceof Error ? error.message : String(error) }); });
    return () => { live = false; };
  }, [api]);
  if (state.error) return <p className="empty-state">Proof unavailable: {state.error}</p>;
  if (!state.report) return <p className="empty-state">Measuring…</p>;
  return <ProofPage report={state.report} />;
}

function EntityListContainer({
  api,
  title,
  section,
  load,
}: {
  api: KageApiClient;
  title: string;
  section: string;
  load: (api: KageApiClient) => Promise<EntityListDto>;
}): React.ReactElement {
  const [state, setState] = useState<
    { status: "loading" } | { status: "ready"; list: EntityListDto } | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    load(api)
      .then((list) => {
        if (!cancelled) setState({ status: "ready", list });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: "error", message: error instanceof Error ? error.message : "Unknown error" });
        }
      });
    return () => {
      cancelled = true;
    };
    // `load` is derived from the stable `api` + `section`; keying on section re-fetches on tab change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, section]);

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite">
        Loading {title.toLowerCase()}…
      </p>
    );
  }
  if (state.status === "error") {
    return <p role="alert">{title} are unavailable: {state.message}</p>;
  }
  return <EntityListPage title={title} section={section} list={state.list} />;
}

// Loads live integration health. Fetched lazily (only when the Integrations section is open) so it
// never sits on the context-delivery critical path.
function IntegrationsContainer({ api }: { api: KageApiClient }): React.ReactElement {
  const [state, setState] = useState<
    { status: "loading" } | { status: "ready"; integrations: IntegrationDto[] } | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    api
      .integrations()
      .then((response) => {
        if (!cancelled) setState({ status: "ready", integrations: response.integrations });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: "error", message: error instanceof Error ? error.message : "Unknown error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (state.status === "loading") {
    return (
      <p role="status" aria-live="polite">
        Loading integrations…
      </p>
    );
  }
  if (state.status === "error") {
    return <p role="alert">Integrations are unavailable: {state.message}</p>;
  }
  return <IntegrationsPage integrations={state.integrations} />;
}

function RoutedPage({
  route,
  overview,
  api,
}: {
  route: Route;
  overview: OverviewDto;
  api: KageApiClient;
}): React.ReactElement {
  switch (route.page) {
    case "activity":
      return <ActivityContainer api={api} />;
    case "attention":
      return <AttentionContainer api={api} />;
    case "work":
      return <WorkContainer api={api} />;
    case "proof":
      return <ProofContainer api={api} />;
    case "work-item":
      return <WorkItemContainer api={api} id={route.id} />;
    case "agents":
      return <AgentsContainer api={api} />;
    case "knowledge-all":
      return <KnowledgeContainer api={api} kind={route.kind} />;
    case "overview":
      if (needsOnboarding(overview)) {
        return <OnboardingPage detectedRepository={overview.repository} />;
      }
      return <OverviewContainer api={api} overview={overview} />;
    case "system-map":
      return <SystemMapContainer api={api} view={(route.view as SystemMapView) ?? "feature"} />;
    case "features":
      return (
        <EntityListContainer
          api={api}
          title="Features"
          section="features"
          load={(a) => a.features().then((f) => ({ kind: "feature", entities: f.features }))}
        />
      );
    case "feature":
      return (
        <DetailContainer<EntityDetailDto>
          slug={route.slug}
          label="feature"
          load={(slug) => api.feature(slug)}
          render={(feature) => <FeaturePage feature={feature} />}
        />
      );
    case "components":
      return (
        <EntityListContainer api={api} title="Components" section="components" load={(a) => a.components()} />
      );
    // One list page and one detail page for every knowledge kind. The label is derived from the
    // route so adding a kind is a router change, not another near-identical page component.
    case "knowledge":
      return (
        <EntityListContainer
          api={api}
          title={KNOWLEDGE_LABELS[route.kind] ?? route.kind}
          section={route.kind}
          load={(a) => a.knowledgeList(route.kind)}
        />
      );
    case "knowledge-detail":
      return (
        <DetailContainer<EntityDetailDto>
          slug={route.slug}
          label={KNOWLEDGE_LABELS[route.kind] ?? route.kind}
          load={(slug) => api.knowledgeDetail(route.kind, slug)}
          render={(entity) => <FeaturePage feature={entity} />}
        />
      );
    case "component":
      return (
        <DetailContainer<EntityDetailDto>
          slug={route.slug}
          label="component"
          load={(slug) => api.component(slug)}
          render={(component) => <FeaturePage feature={component} />}
        />
      );
    case "flows":
      return <EntityListContainer api={api} title="Flows" section="flows" load={(a) => a.flows()} />;
    case "flow":
      return (
        <DetailContainer<EntityDetailDto>
          slug={route.slug}
          label="flow"
          load={(slug) => api.flow(slug)}
          render={(flow) => <FeaturePage feature={flow} />}
        />
      );
    case "runbooks":
      return <EntityListContainer api={api} title="Runbooks" section="runbooks" load={(a) => a.runbooks()} />;
    case "runbook":
      return (
        <DetailContainer<RunbookDetailDto>
          slug={route.slug}
          label="runbook"
          load={(slug) => api.runbook(slug)}
          render={(runbook) => <RunbookPage runbook={runbook} />}
        />
      );
    case "decisions":
      return <EntityListContainer api={api} title="Decisions" section="decisions" load={(a) => a.decisions()} />;
    case "decision":
      return (
        <DetailContainer<DecisionDetailDto>
          slug={route.slug}
          label="decision"
          load={(slug) => api.decision(slug)}
          render={(decision) => <DecisionPage decision={decision} />}
        />
      );
    case "review":
      return <ReviewQueueContainer api={api} />;
    case "tasks":
    case "costs":
      return <AgentTasksContainer api={api} />;
    case "task":
      return (
        <DetailContainer<TaskReceiptDto>
          slug={route.id}
          label="task receipt"
          load={(id) => api.taskReceipt(id)}
          render={(receipt) => <TaskReceiptPage receipt={receipt} />}
        />
      );
    case "integrations":
      return <IntegrationsContainer api={api} />;
    case "settings":
      return <SettingsPage />;
    case "billing":
      // The portal is served by the LOCAL daemon, which deliberately has no workspace-billing feed:
      // putting one on this page would place the (remote) workspace on a path the local portal needs
      // to render, and a workspace outage must never degrade local operation. The workspace serves
      // this DTO itself at GET /v1/workspaces/:id/billing; until an install is linked to one, the
      // honest answer for a local install is "no workspace connected", which is exactly what a null
      // panel renders — never a fabricated plan or an empty-looking subscription.
      return <BillingPage billing={null} />;
    case "admin-diagnostics":
      return <AdminDiagnosticsPage />;
    case "not-found":
      return <NotFoundPage path={route.path} />;
  }
}

export function App({ api }: AppProps): React.ReactElement {
  const route = useRoute();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    api
      .overview()
      .then((overview) => {
        if (!cancelled) setState({ status: "ready", overview });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const repository = state.status === "ready" ? state.overview.repository : null;

  return (
    <AppShell repository={repository} route={routeToPath(route)}>
      {state.status === "loading" && (
        <p role="status" aria-live="polite">
          Loading repository knowledge…
        </p>
      )}
      {state.status === "error" && (
        <p role="alert">Repository knowledge is unavailable: {state.message}</p>
      )}
      {state.status === "ready" && (
        <RoutedPage route={route} overview={state.overview} api={api} />
      )}
    </AppShell>
  );
}
