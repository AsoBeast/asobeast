export type QueueCommand =
  | { kind: "move"; delta: 1 | -1 }
  | { kind: "open" }
  | { kind: "done" }
  | { kind: "snooze" }
  | { kind: "dismiss" }
  | { kind: "select" }
  | { kind: "search" }
  | { kind: "help" }
  | { kind: "clear" };

type KeyEvent = Pick<
  KeyboardEvent,
  "key" | "shiftKey" | "metaKey" | "ctrlKey" | "altKey"
>;

const PLAIN_KEYS: Record<string, QueueCommand> = {
  j: { kind: "move", delta: 1 },
  ArrowDown: { kind: "move", delta: 1 },
  k: { kind: "move", delta: -1 },
  ArrowUp: { kind: "move", delta: -1 },
  Enter: { kind: "open" },
  o: { kind: "open" },
  d: { kind: "done" },
  s: { kind: "snooze" },
  x: { kind: "select" },
  "/": { kind: "search" },
  Escape: { kind: "clear" },
};

const SHIFTED_KEYS: Record<string, QueueCommand> = {
  D: { kind: "dismiss" },
  "?": { kind: "help" },
};

export const ROW_COMMANDS: ReadonlyArray<QueueCommand["kind"]> = [
  "move",
  "open",
  "done",
  "snooze",
  "dismiss",
  "select",
];

const PAGE_KEYS: ReadonlySet<string> = new Set(["j", "k", "/", "?"]);

export interface KeyScope {
  inQueue: boolean;
  withinRow: boolean;
  onRow: boolean;
}

export function commandApplies(
  event: Pick<KeyEvent, "key">,
  command: QueueCommand,
  scope: KeyScope,
): boolean {
  if (PAGE_KEYS.has(event.key)) return true;
  if (!scope.inQueue) return false;
  if (command.kind === "move") return scope.withinRow;
  return !ROW_COMMANDS.includes(command.kind) || scope.onRow;
}

export function commandFor(event: KeyEvent): QueueCommand | null {
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  const table = event.shiftKey ? SHIFTED_KEYS : PLAIN_KEYS;
  return table[event.key] ?? null;
}

const TYPING_SELECTOR =
  "input, textarea, select, [contenteditable='true'], [role='combobox'], [role='textbox'], [role='searchbox']";

interface TypingCandidate {
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const candidate = target as TypingCandidate | null;
  if (typeof candidate?.closest !== "function") return false;
  return (
    candidate.isContentEditable === true ||
    candidate.closest(TYPING_SELECTOR) !== null
  );
}

export function nextFocus(
  ids: readonly string[],
  current: string | null,
  delta: 1 | -1,
): string | null {
  if (ids.length === 0) return null;
  const index = current === null ? -1 : ids.indexOf(current);
  if (index === -1) return ids[0];
  return ids[Math.min(ids.length - 1, Math.max(0, index + delta))];
}
