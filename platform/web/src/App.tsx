import { useCallback, useEffect, useState } from "react";
import type { KageApiClient } from "./api/client";
import type { TeamReportDto,
  AttentionItemDto,
  AttentionQueueDto,
  WorkBoardDto,
  WorkCardDto,
  ProofReportDto,
  WorkDetailDto,
  AgentsReportDto,
  DecisionDetailDto,
  EntityDetailDto,
  EntityListDto,
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
import { DecisionPage } from "./pages/DecisionPage";
import { EntityListPage } from "./pages/EntityListPage";
import { AttentionPage } from "./pages/AttentionPage";
import { InboxPage } from "./pages/InboxPage";
import { CardsPage, type CardsFilter, type KnowledgeCard } from "./pages/CardsPage";
import { ReceiptsPage, type ReceiptsView } from "./pages/ReceiptsPage";
import { ProofPage } from "./pages/ProofPage";
import { WorkItemPage } from "./pages/WorkItemPage";
import { ActivityPage } from "./pages/ActivityPage";
import { FREE_FORM, StartAgentSheet } from "./components/StartAgentSheet";
import { buildBrief, buildFreeFormBrief, desktop, type Brief, type DesktopCard, type DesktopRepo, type DesktopSession, type MineOutcome } from "./desktop";
import { FirstRunPage } from "./pages/FirstRunPage";
import { KnowledgePage, type KnowledgeKind } from "./pages/KnowledgePage";
import { WORK_CHANGED_EVENT } from "./components/LiveIndicator";
import { WorkPage } from "./pages/WorkPage";
import { FeaturePage } from "./pages/FeaturePage";
import { OnboardingPage } from "./pages/OnboardingPage";
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
        <a href={withBase("/activity")}>Return to Activity</a>
      </p>
    </section>
  );
}

// Loads the system map for the current view and hosts the interactive page. The map is fetched
// lazily (only when the System Map section is open) and re-fetched when the view or focus changes,
// so it NEVER sits on the context-delivery critical path. Switching views navigates the URL (which
// resets focus); expanding a node sets a focus that re-roots the two-hop window in place.
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

  // Two-phase, because the knowledge on each card is the expensive part: one full recall plus a
  // risk report PER CARD, measured at ~4.8s each. Waiting for all of it before showing anything
  // meant staring at "Deriving…" for the better part of a minute on a cold daemon.
  //
  // So the cards land first (~2s) and their knowledge fills in behind. The second response is a
  // superset of the first, so nothing shown ever changes underneath the reader — it only gains.
  const reload = useCallback(() => {
    api.work({ knowledge: false })
      .then((fast: WorkBoardDto) => {
        // Never overwrite a board that already has knowledge with one that does not — the live
        // refresh and this initial load can otherwise race and visibly strip the cards.
        setBoard((current) => (current?.items.some((item) => item.knowledge.length > 0) ? current : fast));
      })
      .catch(() => { /* the full request below reports the error */ });

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
  const [sessions, setSessions] = useState<DesktopSession[]>([]);

  // Start-an-agent state. All of it is desktop-only; in a browser the sheet never opens because
  // the button that opens it is not rendered.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [items, setItems] = useState<WorkCardDto[] | null>(null);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  /** What the user typed, when they chose to describe a task instead of picking a work item. */
  const [task, setTask] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const reload = useCallback(() => {
    api.attention().then((queue: AttentionQueueDto) => setAttention(queue.items)).catch(() => setAttention([]));
    api.tasks().then((body: TasksDto) => setTasks(body.tasks)).catch(() => setTasks([]));
    api.agents().then((report: AgentsReportDto) => setAgents(report)).catch(() => setAgents(null));
  }, [api]);

  useEffect(reload, [reload]);
  useLiveRefresh(reload);

  // Live sessions are pushed from the main process as the agent streams; the initial fetch covers
  // a window opened while something was already running.
  useEffect(() => {
    const bridge = desktop();
    if (!bridge) return;
    void bridge.getSessions().then(setSessions);
    return bridge.onSessions(setSessions);
  }, []);

  const openSheet = useCallback(() => {
    setStartError(null);
    setSheetOpen(true);
    setItems(null);
    api
      // The picker needs id, title and stage — nothing else. Asking for knowledge here would
      // make opening the sheet wait on five full recalls for data it never renders.
      .work({ knowledge: false })
      .then((board) => {
        setItems(board.items);
        // Default to the first item that is not already finished — the common intent.
        const first = board.items.find((item) => item.stage !== "done") ?? board.items[0];
        if (first) setSelectedWorkId(first.work_id);
      })
      .catch(() => setItems([]));
  }, [api]);

  // The brief is re-composed whenever the selection or the typed task changes, so the preview can
  // never describe something other than what will run.
  useEffect(() => {
    if (!sheetOpen) return;
    // Nothing selected IS the free-form case, matching the sheet — see its `mode` note.
    const workId = selectedWorkId ?? FREE_FORM;
    if (workId === FREE_FORM) {
      // Composed locally and synchronously: the task IS the brief, so there is nothing to fetch and
      // no in-flight state to show.
      setBrief(task.trim() ? buildFreeFormBrief(task) : null);
      return;
    }
    setBrief(null);
    let live = true;
    api
      .workItem(workId)
      .then((detail) => { if (live) setBrief(buildBrief(detail)); })
      .catch(() => { if (live) setStartError("Could not assemble a brief for that item."); });
    return () => { live = false; };
  }, [api, sheetOpen, selectedWorkId, task]);

  const start = useCallback(
    (agent: string) => {
      const bridge = desktop();
      if (!bridge || !brief) return;
      const freeForm = (selectedWorkId ?? FREE_FORM) === FREE_FORM;
      setStarting(true);
      setStartError(null);
      void bridge
        .startSession({
          // A typed task belongs to no work item, and saying otherwise would attach its receipts to
          // work nobody claimed.
          work_id: freeForm ? null : selectedWorkId,
          // Main cannot resolve a work id to a title, so the title travels with the request and
          // comes back on the session — the running card names the work, not an opaque id.
          work_title: freeForm
            ? null
            : (items ?? []).find((item) => item.work_id === selectedWorkId)?.title ?? null,
          agent,
          prompt: brief.prompt,
        })
        .then((result) => {
          setStarting(false);
          if (result.ok) setSheetOpen(false);
          else setStartError(result.error ?? "The agent could not be started.");
        })
        .catch((error: unknown) => {
          setStarting(false);
          setStartError(error instanceof Error ? error.message : String(error));
        });
    },
    [brief, selectedWorkId, items],
  );

  return (
    <>
      <ActivityPage
        sessions={sessions}
        attention={attention}
        tasks={tasks}
        agents={agents}
        canStartAgents={desktop() !== null}
        onStartAgent={openSheet}
        onStopSession={(id) => void desktop()?.stopSession(id).then(setSessions)}
      />
      {sheetOpen && (
        <StartAgentSheet
          items={items}
          brief={brief}
          selectedWorkId={selectedWorkId}
          task={task}
          onSelectWork={setSelectedWorkId}
          onTaskChange={setTask}
          onStart={start}
          onCancel={() => setSheetOpen(false)}
          busy={starting}
          error={startError}
        />
      )}
    </>
  );
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

// Proof absorbed Overview, so it now loads BOTH the derived proof report and the value ledger.
// The two used to live on separate pages showing the same measured value in two visual languages.
// The ledger fails independently: a null one renders an honest absence, never a zero.
function ProofContainer({ api }: { api: KageApiClient }): React.ReactElement {
  const [state, setState] = useState<{ report: ProofReportDto | null; error: string | null }>({ report: null, error: null });
  const [ledger, setLedger] = useState<TeamReportDto | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    api.proof()
      .then((report: ProofReportDto) => { if (live) setState({ report, error: null }); })
      .catch((error: unknown) => { if (live) setState({ report: null, error: error instanceof Error ? error.message : String(error) }); });
    api.teamReport()
      .then((body) => { if (live) setLedger(body.report); })
      .catch(() => { if (live) setLedger(null); });
    return () => { live = false; };
  }, [api]);
  if (state.error) return <p className="empty-state">Proof unavailable: {state.error}</p>;
  if (!state.report) return <p className="empty-state">Measuring…</p>;
  // `undefined` means the ledger is still in flight; render the page once we actually know.
  return <ProofPage report={state.report} ledger={ledger === undefined ? null : ledger} />;
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


// The Inbox: the Librarian's proposals awaiting a human verdict. Desktop-only mutations — the
// browser portal renders the list read-only, because approval mutates the shadow store.
function InboxContainer(): React.ReactElement {
  const bridge = desktop();
  const [cards, setCards] = useState<DesktopCard[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [mining, setMining] = useState(false);
  const [lastMine, setLastMine] = useState<MineOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!bridge) {
      setCards([]);
      return;
    }
    bridge
      .listCards()
      .then(setCards)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [bridge]);

  useEffect(() => {
    load();
    return bridge?.onCardsChanged(load);
  }, [bridge, load]);

  const verdict = useCallback(
    (action: Promise<{ ok: boolean; error?: string }>, id: string) => {
      setBusy(id);
      setError(null);
      void action
        .then((result) => {
          if (!result.ok) setError(result.error ?? "the verdict could not be recorded");
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => {
          setBusy(null);
          load();
        });
    },
    [load],
  );

  return (
    <InboxPage
      cards={cards}
      busy={busy}
      mining={mining}
      lastMine={lastMine}
      error={error}
      canMutate={bridge !== null}
      onApprove={(id) => bridge && verdict(bridge.approveCard(id), id)}
      onReject={(id, reason) => bridge && verdict(bridge.rejectCard(id, reason), id)}
      onMine={() => {
        if (!bridge) return;
        setMining(true);
        setError(null);
        void bridge
          .mineHistory()
          .then(setLastMine)
          .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
          .finally(() => {
            setMining(false);
            load();
          });
      }}
    />
  );
}


// Cards — what the team currently believes. Reads the same bridge the Inbox does; the only
// mutation offered here is supersede, and it is null in a browser where it could not execute.
function CardsContainer(): React.ReactElement {
  const bridge = desktop();
  const [cards, setCards] = useState<KnowledgeCard[] | null>(null);
  const [filter, setFilter] = useState<CardsFilter>({ kind: "all", trust: "all" });

  const load = useCallback(() => {
    if (!bridge) {
      setCards([]);
      return;
    }
    bridge.listCards().then((next) => setCards(next as KnowledgeCard[])).catch(() => setCards([]));
  }, [bridge]);

  useEffect(() => {
    load();
    return bridge?.onCardsChanged(load);
  }, [bridge, load]);

  return <CardsPage cards={cards} filter={filter} onFilter={setFilter} onSupersede={null} />;
}

// Receipts — counted events only. `loading` is threaded as its own state because an unread ledger
// and an empty one are different claims.
function ReceiptsContainer(): React.ReactElement {
  const bridge = desktop();
  const [view, setView] = useState<ReceiptsView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bridge) {
      setLoading(false);
      return;
    }
    let live = true;
    bridge
      .readReceipts()
      .then((next) => { if (live) setView(next as ReceiptsView); })
      .catch(() => { if (live) setView(null); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [bridge]);

  return <ReceiptsPage view={view} loading={loading} />;
}

function RoutedPage({
  route,
  overview,
  api,
  desktopRepos,
  activeRepoPath,
  onSwitchRepo,
  onAddRepo,
  onRemoveRepo,
}: {
  route: Route;
  overview: OverviewDto;
  api: KageApiClient;
  desktopRepos?: DesktopRepo[];
  activeRepoPath?: string | null;
  onSwitchRepo?: (path: string) => void;
  onAddRepo?: () => void;
  onRemoveRepo?: (path: string) => void;
}): React.ReactElement {
  switch (route.page) {
    case "activity":
      return <ActivityContainer api={api} />;
    case "inbox":
      return <InboxContainer />;
    case "cards":
      return <CardsContainer />;
    case "receipts":
      return <ReceiptsContainer />;
    case "attention":
      return <AttentionContainer api={api} />;
    case "work":
      return <WorkContainer api={api} />;
    case "proof":
      return <ProofContainer api={api} />;
    case "work-item":
      return <WorkItemContainer api={api} id={route.id} />;
    // Agents folded into Activity — an agent reaches a repository three ways, and three
    // separate screens for one subject is not an architecture. The route still resolves.
    case "agents":
      return <ActivityContainer api={api} />;
    case "knowledge-all":
      return <KnowledgeContainer api={api} kind={route.kind} />;
    case "overview":
      // Overview was absorbed into Proof — they showed the same measured value in two visual
      // languages. The route still resolves so a bookmark keeps working; it just lands on the one
      // page that makes the claim.
      if (needsOnboarding(overview)) {
        return <OnboardingPage detectedRepository={overview.repository} />;
      }
      return <ProofContainer api={api} />;
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
    case "settings":
      return (
        <SettingsPage
          desktopRepos={desktopRepos}
          activeRepoPath={activeRepoPath}
          onSwitchRepo={onSwitchRepo}
          onAddRepo={onAddRepo}
          onRemoveRepo={onRemoveRepo}
        />
      );
    case "admin-diagnostics":
      return <AdminDiagnosticsPage />;
    case "not-found":
      return <NotFoundPage path={route.path} />;
  }
}

export function App({ api }: AppProps): React.ReactElement {
  const route = useRoute();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // undefined = not asked yet (or not the desktop app). An empty array is a FACT: no repositories.
  const [repos, setRepos] = useState<DesktopRepo[] | undefined>(undefined);
  const [active, setActive] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  useEffect(() => {
    const bridge = desktop();
    if (!bridge) return;
    void bridge.getState().then((next) => {
      setRepos(next.repos);
      setActive(next.active);
    });
    return bridge.onState((next) => {
      setRepos(next.repos);
      setActive(next.active);
    });
  }, []);

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

  const addRepository = useCallback(() => {
    const bridge = desktop();
    if (!bridge) return;
    setAddBusy(true);
    void bridge.addRepository().finally(() => setAddBusy(false));
  }, []);

  const switchRepository = useCallback((path: string) => {
    void desktop()?.switchRepository(path);
  }, []);

  const removeRepository = useCallback((path: string) => {
    void desktop()?.removeRepository(path);
  }, []);

  // With no repository there is no daemon, so every call 503s and the shell used to render
  // "Repository knowledge is unavailable" — a technical error for a state that is not an error.
  // It is simply the beginning, and it gets a screen that says so.
  if (repos?.length === 0) {
    return (
      <AppShell repository={null} route={routeToPath(route)}>
        <FirstRunPage onAddRepository={addRepository} busy={addBusy} />
      </AppShell>
    );
  }

  const repository = state.status === "ready" ? state.overview.repository : null;

  return (
    <AppShell
      repository={repository}
      route={routeToPath(route)}
      desktopRepos={repos}
      activeRepoPath={active}
      onSwitchRepo={repos ? switchRepository : undefined}
      onAddRepo={repos ? addRepository : undefined}
      onRemoveRepo={repos ? removeRepository : undefined}
    >
      {state.status === "loading" && (
        <p role="status" aria-live="polite">
          Loading repository knowledge…
        </p>
      )}
      {state.status === "error" && (
        <p role="alert">Repository knowledge is unavailable: {state.message}</p>
      )}
      {state.status === "ready" && (
        <RoutedPage
          route={route}
          overview={state.overview}
          api={api}
          desktopRepos={repos}
          activeRepoPath={active}
          onSwitchRepo={repos ? switchRepository : undefined}
          onAddRepo={repos ? addRepository : undefined}
          onRemoveRepo={repos ? removeRepository : undefined}
        />
      )}
    </AppShell>
  );
}
