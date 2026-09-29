const ROW_SELECTOR = "#queue li[id^='action-']";

export function focusAfterRemoval(id: string): void {
  const rows = [...document.querySelectorAll<HTMLElement>(ROW_SELECTOR)];
  const index = rows.findIndex((row) => row.id === `action-${id}`);
  const neighbour = rows[index + 1] ?? rows[index - 1];
  const target =
    neighbour ??
    document.querySelector<HTMLElement>('input[aria-label="Search actions"]');
  requestAnimationFrame(() => target?.focus());
}
