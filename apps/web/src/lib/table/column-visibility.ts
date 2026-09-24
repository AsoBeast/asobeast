import type { ColumnVisibilityState } from "@tanstack/react-table";

const PREFIX = "asobeast.columns.";

export interface TableColumnMeta {
  label?: string;
  phone?: boolean;
}

function isVisibilityState(value: unknown): value is ColumnVisibilityState {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "boolean")
  );
}

export function parseColumnVisibility(
  raw: string | null,
): ColumnVisibilityState | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isVisibilityState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readStoredColumns(
  storage: () => Pick<Storage, "getItem">,
  table: string,
): string | null {
  try {
    return storage().getItem(PREFIX + table);
  } catch {
    return null;
  }
}

export function writeColumnVisibility(
  storage: () => Pick<Storage, "setItem">,
  table: string,
  state: ColumnVisibilityState,
): boolean {
  try {
    storage().setItem(PREFIX + table, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function phoneColumnVisibility(
  columns: ReadonlyArray<{ id?: string; meta?: TableColumnMeta }>,
): ColumnVisibilityState {
  return Object.fromEntries(
    columns
      .filter((column) => column.id && column.meta?.label && !column.meta.phone)
      .map((column) => [column.id, false]),
  );
}

export function columnChoices(
  stored: ColumnVisibilityState,
  current: ColumnVisibilityState,
  next: ColumnVisibilityState,
  fallback: ColumnVisibilityState,
): ColumnVisibilityState {
  const choices = { ...stored };
  for (const id of new Set([...Object.keys(current), ...Object.keys(next)])) {
    const visible = next[id] ?? true;
    if (visible === (current[id] ?? true)) continue;
    if (visible === (fallback[id] ?? true)) delete choices[id];
    else choices[id] = visible;
  }
  return choices;
}
