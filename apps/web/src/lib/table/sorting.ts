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
