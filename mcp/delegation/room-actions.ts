// The kage-actions protocol — the manager may end any Room reply with one fenced block
// labelled kage-actions, holding JSON that turns the reply into clickable chips/cards
// instead of a wall of prose the user has to type back into. Shared by both legs that
// produce a manager turn (the held headless supervisor and the one-shot askManager
// fallback, both in api.ts) so the fence is parsed and stripped exactly once, the same
// way, everywhere it can appear.

export interface KageActionOption {
  label: string;
  /** The exact message a click sends, via the same composer path a typed message uses. */
  send: string;
}

export interface KageActionProposal {
  intent: string;
  type: string;
}

export type KageActionKind = "open_run" | "dispatch" | "create_goal";

export interface KageAction {
  label: string;
  kind: KageActionKind;
  payload?: Record<string, unknown>;
}

/** Exactly one of these three shapes — never a mix of the three keys. */
export interface RoomActions {
  question?: string;
  options?: KageActionOption[];
  proposals?: KageActionProposal[];
  actions?: KageAction[];
}

export interface ParsedReply {
  /** The manager's reply with the kage-actions fence stripped out — unchanged from the
   * input when no valid fence was found. */
  text: string;
  actions?: RoomActions;
}

const ACTION_KINDS = new Set<KageActionKind>(["open_run", "dispatch", "create_goal"]);
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;

// Requires the fence to be the LAST thing in the reply — "may end any reply with one
// fenced block" — so a code sample the manager shows mid-answer, even one that happens
// to use this same language tag, is never mistaken for the protocol.
const KAGE_ACTIONS_FENCE = /\n?```kage-actions[ \t]*\n([\s\S]*?)\n?```[ \t]*$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidOption(value: unknown): value is KageActionOption {
  return isPlainObject(value) && typeof value.label === "string" && typeof value.send === "string";
}

function isValidProposal(value: unknown): value is KageActionProposal {
  return isPlainObject(value) && typeof value.intent === "string" && typeof value.type === "string";
}

function isValidAction(value: unknown): value is KageAction {
  if (!isPlainObject(value)) return false;
  if (typeof value.label !== "string") return false;
  if (typeof value.kind !== "string" || !ACTION_KINDS.has(value.kind as KageActionKind)) return false;
  if (value.payload !== undefined && !isPlainObject(value.payload)) return false;
  return true;
}

/**
 * Validates and narrows a parsed JSON value to one of the three protocol shapes. Returns
 * null for anything that does not cleanly match one of them — malformed items in an
 * otherwise-recognized array make the WHOLE block malformed rather than silently
 * dropping the bad entries, since a manager whose JSON is half-wrong is not a manager
 * whose intent can be safely guessed at.
 */
export function normalizeKageActions(parsed: unknown): RoomActions | null {
  if (!isPlainObject(parsed)) return null;

  if (typeof parsed.question === "string" && Array.isArray(parsed.options)) {
    const options = parsed.options.filter(isValidOption);
    if (options.length !== parsed.options.length) return null;
    if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) return null;
    return { question: parsed.question, options };
  }

  if (Array.isArray(parsed.proposals)) {
    const proposals = parsed.proposals.filter(isValidProposal);
    if (proposals.length !== parsed.proposals.length || !proposals.length) return null;
    return { proposals };
  }

  if (Array.isArray(parsed.actions)) {
    const actions = parsed.actions.filter(isValidAction);
    if (actions.length !== parsed.actions.length || !actions.length) return null;
    return { actions };
  }

  return null;
}

/**
 * Extracts a trailing kage-actions fence from a manager reply. On a valid block, returns
 * the reply with the fence stripped and the parsed actions. On anything else — no fence,
 * unparseable JSON, or JSON that does not match one of the three protocol shapes — the
 * text comes back completely unchanged (fence included) and actions is undefined, so a
 * malformed attempt is never silently lost, only left visible as ordinary text.
 */
export function parseKageActionsReply(raw: string): ParsedReply {
  const match = raw.match(KAGE_ACTIONS_FENCE);
  if (!match) return { text: raw };

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(match[1]);
  } catch {
    return { text: raw };
  }

  const actions = normalizeKageActions(parsedJson);
  if (!actions) return { text: raw };

  return { text: raw.slice(0, match.index).trimEnd(), actions };
}
