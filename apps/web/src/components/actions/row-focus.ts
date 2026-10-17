import { survivingNeighbour } from "@/lib/focus-handoff";

const ROW_SELECTOR = "#queue li[id^='action-']";
const SEARCH_SELECTOR = 'input[aria-label="Search actions"]';

const queueRows = () => [
  ...document.querySelectorAll<HTMLElement>(ROW_SELECTOR),
];
const searchInput = () => document.querySelector<HTMLElement>(SEARCH_SELECTOR);

export function focusAfterRemoval(id: string): void {
  const rows = queueRows();
  const index = rows.findIndex((row) => row.id === `action-${id}`);
  const target = rows[index + 1] ?? rows[index - 1] ?? searchInput();
  requestAnimationFrame(() => target?.focus());
}

export function bulkFocusTarget(
  selected: readonly string[],
  removesRows: boolean,
): HTMLElement | null {
  const chosen = new Set(selected.map((id) => `action-${id}`));
  const isChosen = (row: HTMLElement) => chosen.has(row.id);
  const rows = queueRows();
  const target = removesRows
    ? survivingNeighbour(rows, isChosen)
    : rows.find(isChosen);
  return target ?? searchInput();
}
