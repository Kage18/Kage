// Terminal primitives, dependency-free. The repo's minimal-dependency rule applies to
// the UI too: everything here is escape codes and string math, no framework.
export const ESC = "";

export const ALT_SCREEN_ON = `${ESC}[?1049h`;
export const ALT_SCREEN_OFF = `${ESC}[?1049l`;
export const CURSOR_HIDE = `${ESC}[?25l`;
export const CURSOR_SHOW = `${ESC}[?25h`;
export const CURSOR_HOME = `${ESC}[H`;
export const CLEAR_BELOW = `${ESC}[J`;
export const CLEAR_ALL = `${ESC}[2J`;
/** Erase from the cursor to the end of the line — without it, a shorter new line leaves the old line's tail on screen. */
export const CLEAR_LINE_END = `${ESC}[K`;
/**
 * Auto-wrap off while the UI owns the screen. With it on, a line that reaches the last
 * column wraps and pushes every row up — the whole frame scrolls and the header walks
 * off the top. This single flag prevents the worst class of TUI corruption.
 */
export const WRAP_OFF = `${ESC}[?7l`;
export const WRAP_ON = `${ESC}[?7h`;

const CODES = {
  reset: 0,
  bold: 1,
  dim: 2,
  italic: 3,
  underline: 4,
  reverse: 7,
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  gray: 90,
  brightGreen: 92,
  brightYellow: 93,
  brightBlue: 94,
  brightMagenta: 95,
  brightCyan: 96,
} as const;

export type Style = keyof typeof CODES;

let enabled = true;
/** Tests and pipes render plain text; only a real TTY gets escape codes. */
export function setColorEnabled(value: boolean): void {
  enabled = value;
}

export function style(text: string, ...styles: Style[]): string {
  if (!enabled || !styles.length) return text;
  return `${ESC}[${styles.map((name) => CODES[name]).join(";")}m${text}${ESC}[0m`;
}

/** Visible width, ignoring escape sequences (so padding math stays correct). */
export function visibleWidth(text: string): number {
  return stripAnsi(text).length;
}

export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\[[0-9;]*[A-Za-z]/g, "");
}

export function truncate(text: string, max: number): string {
  if (max <= 0) return "";
  const plain = stripAnsi(text);
  if (plain.length <= max) return text;
  // Cutting styled text mid-sequence would leak escape codes onto the rest of the
  // screen, so styled text is walked and closed off cleanly instead.
  if (!text.includes(ESC)) return `${plain.slice(0, Math.max(0, max - 1))}…`;
  let visible = 0;
  let out = "";
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === ESC) {
      const end = text.indexOf("m", index);
      if (end === -1) break;
      out += text.slice(index, end + 1);
      index = end;
      continue;
    }
    if (visible >= max - 1) break;
    out += text[index];
    visible += 1;
  }
  return `${out}…${ESC}[0m`;
}

export function pad(text: string, width: number): string {
  const gap = width - visibleWidth(text);
  return gap > 0 ? text + " ".repeat(gap) : text;
}

export function fit(text: string, width: number): string {
  return pad(truncate(text, width), width);
}

/** Wrap plain text to a width, preserving explicit newlines. */
export function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (!line.length) line = word;
      else if (line.length + 1 + word.length <= width) line += ` ${word}`;
      else {
        out.push(line);
        line = word;
      }
    }
    if (line.length) out.push(line);
  }
  return out;
}

export interface Key {
  name: string;
  ctrl: boolean;
  raw: string;
}

/**
 * A single read can carry several keypresses (fast typing, key repeat, a paste, or two
 * arrow presses). Split into individual keys, keeping each escape sequence whole —
 * without this, holding an arrow key produces one unrecognised blob and the UI freezes.
 */
export function splitKeys(chunk: string): string[] {
  const keys: string[] = [];
  let index = 0;
  while (index < chunk.length) {
    if (chunk[index] !== ESC) {
      keys.push(chunk[index]);
      index += 1;
      continue;
    }
    // ESC [ ... final-byte, ESC O x, or a bare ESC.
    let end = index + 1;
    if (chunk[end] === "[" || chunk[end] === "O") {
      end += 1;
      while (end < chunk.length && /[0-9;]/.test(chunk[end])) end += 1;
      if (end < chunk.length) end += 1;
    }
    keys.push(chunk.slice(index, Math.max(end, index + 1)));
    index = Math.max(end, index + 1);
  }
  return keys;
}

/** Minimal keypress decoding: enough for arrows, enter, backspace, tab, ctrl-c. */
export function decodeKey(data: string): Key {
  const map: Record<string, string> = {
    "[A": "up",
    "[B": "down",
    "[C": "right",
    "[D": "left",
    "[5~": "pageup",
    "[6~": "pagedown",
    "[H": "home",
    "[F": "end",
    "\r": "enter",
    "\n": "enter",
    "\t": "tab",
    "": "backspace",
    "\b": "backspace",
    "": "escape",
    " ": "space",
  };
  if (map[data]) return { name: map[data], ctrl: false, raw: data };
  if (data === "") return { name: "c", ctrl: true, raw: data };
  if (data === "") return { name: "d", ctrl: true, raw: data };
  return { name: data, ctrl: false, raw: data };
}
