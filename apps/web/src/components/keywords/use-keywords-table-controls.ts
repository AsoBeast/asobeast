"use client";

import { useQueryStates } from "nuqs";
import type { Store } from "@asobeast/shared";
import { useUrlSorting } from "@/components/data-table/useUrlSorting";
import { useStoredColumnVisibility } from "@/components/data-table/useStoredColumnVisibility";
import {
  KEYWORD_DEFAULT_SORT,
  keywordSortParser,
  sortDirectionParser,
} from "@/lib/search-params";
import { listingMarksOption } from "./listing-marks-option";

export function useKeywordsTableControls({
  store,
  columns,
}: {
  store: Store;
  columns: Parameters<typeof useUrlSorting>[1];
}) {
  const [{ sort, dir }, setSortParams] = useQueryStates({
    sort: keywordSortParser,
    dir: sortDirectionParser,
  });
  const { sorting, onSortingChange } = useUrlSorting(
    sort === null || columns.some((column) => column.id === sort)
      ? { sort, dir }
      : { sort: null, dir: null },
    columns,
    (next) =>
      void setSortParams({
        sort:
          next.sort === null || next.sort === KEYWORD_DEFAULT_SORT
            ? null
            : keywordSortParser.parse(next.sort),
        dir: next.dir,
      }),
    { remember: "keywords", defaultSort: KEYWORD_DEFAULT_SORT },
  );
  const [visibility, setVisibility] = useStoredColumnVisibility(
    "keywords",
    columns,
  );
  const marks = listingMarksOption(store, visibility, setVisibility);
  return { sorting, onSortingChange, visibility, setVisibility, marks };
}
