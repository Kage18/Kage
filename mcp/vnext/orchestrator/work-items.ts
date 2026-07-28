// WorkItem as a first-class entity — the orchestration facts a memory packet has no business
// carrying.
//
// A proposal packet is MEMORY: a title, a body, the paths it grounds to. Bolting `assignee` and
// `depends_on` onto it would make the memory store the work tracker, and every consumer of
// memory would then have to skip fields that are not knowledge. So this is a SIDECAR, keyed by
// the same work id, holding exactly four things the packet cannot own.
//
// What is deliberately NOT here: the stage log. The design listed it as a persisted field, and
// persisting it now would be a regression — stages are DERIVED from commands plus git, and a
// stored copy would immediately become a second source of truth that can disagree with the
// derivation. That disagreement is precisely the bug the single-writer work fixed. The log is
// computed on read, every time, from evidence.
//
// The field that matters most is `receipt_ids`. Estimation has always reported `confidence:
// "none"` because `receiptHistory()` had nothing to read: receipts are recorded per agent
// SESSION, work is tracked per ITEM, and nothing joined the two. This is that join.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface WorkItemContract {
  /** What must stay true when this work lands. Fed to the contract checker as PR assertions. */
  invariants: string[];
  /** Public surfaces this work is allowed to change. Anything else is a finding. */
  public_surfaces: string[];
}

export interface WorkItemRecord {
  work_id: string;
  /** Who SHOULD do it — distinct from `claimed_by`, which is who currently HOLDS it. */
  assignee: string | null;
  /** Work ids that must land first. Ordering the plan engine can compute and a lead can edit. */
  depends_on: string[];
  contract: WorkItemContract | null;
  /**
   * Receipts measured while this item was being worked. THE join key: an actual, against which
   * an estimate can finally be scored.
   */
  receipt_ids: string[];
  updated_at: string;
}

function itemsDir(projectDir: string): string {
  return join(projectDir, ".agent_memory", "work", "items");
}

/** Work ids contain colons and slashes, so they are not filenames. Encode, never sanitise. */
function fileFor(projectDir: string, workId: string): string {
  return join(itemsDir(projectDir), `${encodeURIComponent(workId)}.json`);
}

function empty(workId: string): WorkItemRecord {
  return {
    work_id: workId,
    assignee: null,
    depends_on: [],
    contract: null,
    receipt_ids: [],
    updated_at: new Date().toISOString(),
  };
}

/** The record for a work item, or an empty one. Never null: absent simply means nothing set. */
export function readWorkItem(projectDir: string, workId: string): WorkItemRecord {
  const path = fileFor(projectDir, workId);
  if (!existsSync(path)) return empty(workId);
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<WorkItemRecord>;
    return {
      work_id: workId,
      assignee: typeof parsed.assignee === "string" ? parsed.assignee : null,
      depends_on: Array.isArray(parsed.depends_on) ? parsed.depends_on.filter((d) => typeof d === "string") : [],
      contract: parsed.contract && typeof parsed.contract === "object"
        ? {
            invariants: Array.isArray(parsed.contract.invariants)
              ? parsed.contract.invariants.filter((i): i is string => typeof i === "string")
              : [],
            public_surfaces: Array.isArray(parsed.contract.public_surfaces)
              ? parsed.contract.public_surfaces.filter((s): s is string => typeof s === "string")
              : [],
          }
        : null,
      receipt_ids: Array.isArray(parsed.receipt_ids)
        ? [...new Set(parsed.receipt_ids.filter((r): r is string => typeof r === "string"))]
        : [],
      updated_at: typeof parsed.updated_at === "string" ? parsed.updated_at : new Date().toISOString(),
    };
  } catch {
    // A torn or hand-edited file must not take the board down; an unreadable sidecar simply
    // means no orchestration facts are set.
    return empty(workId);
  }
}

export interface WorkItemPatch {
  assignee?: string | null;
  depends_on?: string[];
  contract?: WorkItemContract | null;
  /** Appended and de-duplicated — a receipt is never recorded against an item twice. */
  add_receipt_ids?: string[];
}

export function writeWorkItem(projectDir: string, workId: string, patch: WorkItemPatch): WorkItemRecord {
  const current = readWorkItem(projectDir, workId);
  const next: WorkItemRecord = {
    ...current,
    ...(patch.assignee !== undefined ? { assignee: patch.assignee } : {}),
    ...(patch.depends_on !== undefined ? { depends_on: [...new Set(patch.depends_on)] } : {}),
    ...(patch.contract !== undefined ? { contract: patch.contract } : {}),
    receipt_ids: patch.add_receipt_ids
      ? [...new Set([...current.receipt_ids, ...patch.add_receipt_ids])]
      : current.receipt_ids,
    updated_at: new Date().toISOString(),
  };
  mkdirSync(itemsDir(projectDir), { recursive: true });
  writeFileSync(fileFor(projectDir, workId), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

/** Every record on disk. Used to build the receipt history estimation scores against. */
export function listWorkItemRecords(projectDir: string): WorkItemRecord[] {
  const dir = itemsDir(projectDir);
  if (!existsSync(dir)) return [];
  const records: WorkItemRecord[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith(".json")) continue;
    records.push(readWorkItem(projectDir, decodeURIComponent(name.replace(/\.json$/, ""))));
  }
  return records;
}

/**
 * Dependency order for a set of work items, and the cycle if there is one.
 *
 * A cycle is REPORTED rather than broken. Silently picking an order for work that genuinely
 * depends on itself would hand a lead a plan that cannot be executed and looks fine.
 */
export function dependencyOrder(records: readonly WorkItemRecord[]): {
  order: string[];
  cycle: string[];
} {
  const byId = new Map(records.map((r) => [r.work_id, r]));
  const state = new Map<string, "visiting" | "done">();
  const order: string[] = [];
  let cycle: string[] = [];

  const visit = (id: string, path: string[]): void => {
    if (cycle.length || state.get(id) === "done") return;
    if (state.get(id) === "visiting") {
      cycle = [...path.slice(path.indexOf(id)), id];
      return;
    }
    state.set(id, "visiting");
    for (const dep of byId.get(id)?.depends_on ?? []) {
      if (byId.has(dep)) visit(dep, [...path, id]);
    }
    state.set(id, "done");
    order.push(id);
  };

  for (const record of records) visit(record.work_id, []);
  return cycle.length ? { order: [], cycle } : { order, cycle: [] };
}
