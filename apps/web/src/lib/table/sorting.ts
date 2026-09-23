import type { SortingState } from "@tanstack/react-table";

export type SortDirection = "asc" | "desc";

export interface SortDefaults {
  readonly descFirst: ReadonlySet<string>;
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
