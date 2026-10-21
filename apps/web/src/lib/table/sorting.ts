import type { SortingState } from "@tanstack/react-table";

export type SortDirection = "asc" | "desc";

export interface SortDefaults {
  readonly descFirst: ReadonlySet<string>;
}

export interface StoredSort {
  sort: string;
  dir: SortDirection | null;
}

const SORT_PREFIX = "asobeast.sort.";

export function readStoredSort(
  storage: () => Pick<Storage, "getItem">,
  table: string,
): string | null {
  try {
    return storage().getItem(SORT_PREFIX + table);
  } catch {
    return null;
  }
}

export function parseStoredSort(
  raw: string | null,
  known: ReadonlySet<string>,
): StoredSort | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      !("sort" in parsed)
    ) {
      return null;
    }
    const { sort } = parsed;
    const dir: unknown = "dir" in parsed ? parsed.dir : undefined;
    if (typeof sort !== "string" || !known.has(sort)) return null;
    return { sort, dir: dir === "asc" || dir === "desc" ? dir : null };
  } catch {
    return null;
  }
}

export function writeStoredSort(
  storage: () => Pick<Storage, "setItem">,
  table: string,
  value: StoredSort,
): boolean {
  try {
    storage().setItem(SORT_PREFIX + table, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStoredSort(
  storage: () => Pick<Storage, "removeItem">,
  table: string,
): boolean {
  try {
    storage().removeItem(SORT_PREFIX + table);
    return true;
  } catch {
    return false;
  }
}

export function sortingFromUrl(
  sort: string,
  dir: SortDirection | null,
  defaults: SortDefaults,
): SortingState {
  const desc = dir === null ? defaults.descFirst.has(sort) : dir === "desc";
  return [{ id: sort, desc }];
}

export function nullsLast<T>(value: T | null): T | undefined {
  return value ?? undefined;
}

export function urlFromSorting(
  state: SortingState,
  defaults: SortDefaults,
): { sort: string | null; dir: SortDirection | null } {
  const [first] = state;
  if (!first) return { sort: null, dir: null };
  const natural = defaults.descFirst.has(first.id);
  const dir = first.desc === natural ? null : first.desc ? "desc" : "asc";
  return { sort: first.id, dir };
}

export function ariaSort(
  sorted: SortDirection | false,
): "ascending" | "descending" | undefined {
  if (sorted === "asc") return "ascending";
  if (sorted === "desc") return "descending";
  return undefined;
}

export function sortDefaultsOf(
  columns: ReadonlyArray<{ id?: string; sortDescFirst?: boolean }>,
): SortDefaults {
  return {
    descFirst: new Set(
      columns.flatMap((column) =>
        column.id && column.sortDescFirst ? [column.id] : [],
      ),
    ),
  };
}
