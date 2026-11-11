"use client";

import type { KeywordSource } from "@asobeast/shared";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import { oneOf, someOf } from "@/lib/table/facets";
import { TagList } from "./keyword-cells";
import { keywordColumnHelper as columnHelper } from "./keyword-column-helper";
import { SOURCE_LABELS, SourceLabel } from "./SourceLabel";

export function attributeColumns() {
  return [
    columnHelper.accessor((row) => row.tags ?? [], {
      id: "tags",
      header: "Tags",
      enableSorting: false,
      getUniqueValues: (row) => row.tags ?? [],
      filterFn: (row, _id, selected: readonly string[]) =>
        someOf(row.original.tags, selected),
      meta: { label: "Tags" },
      cell: ({ row }) => <TagList tags={row.original.tags ?? []} />,
    }),
    columnHelper.accessor("source", {
      id: "source",
      meta: { label: "Source", hiddenByDefault: true },
      sortFn: (a, b, id) =>
        SOURCE_LABELS[a.getValue<KeywordSource>(id)].localeCompare(
          SOURCE_LABELS[b.getValue<KeywordSource>(id)],
        ),
      sortDescFirst: false,
      filterFn: (row, id, selected: KeywordSource[]) =>
        oneOf(row.getValue<KeywordSource>(id), selected),
      header: ({ column }) => <SortableHeader column={column} label="Source" />,
      cell: ({ row }) => <SourceLabel source={row.original.source} />,
    }),
  ];
}
