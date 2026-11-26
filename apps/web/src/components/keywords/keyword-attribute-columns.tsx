"use client";

import type { KeywordSource } from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import { oneOf, someOf } from "@/lib/table/facets";
import { TagList } from "./keyword-cells";
import { keywordColumnHelper as columnHelper } from "./keyword-column-helper";
import { SourceLabel, sourceLabel } from "./SourceLabel";

export function attributeColumns(t: MessageTranslator) {
  return [
    columnHelper.accessor((row) => row.tags ?? [], {
      id: "tags",
      header: () => <span>{t("table.tags")}</span>,
      enableSorting: false,
      getUniqueValues: (row) => row.tags ?? [],
      filterFn: (row, _id, selected: readonly string[]) =>
        someOf(row.original.tags, selected),
      meta: { label: t("table.tags"), hiddenByDefault: true },
      cell: ({ row }) => <TagList tags={row.original.tags ?? []} />,
    }),
    columnHelper.accessor("source", {
      id: "source",
      meta: { label: t("table.source"), hiddenByDefault: true },
      sortFn: (a, b, id) =>
        sourceLabel(a.getValue<KeywordSource>(id), t).localeCompare(
          sourceLabel(b.getValue<KeywordSource>(id), t),
        ),
      sortDescFirst: false,
      filterFn: (row, id, selected: KeywordSource[]) =>
        oneOf(row.getValue<KeywordSource>(id), selected),
      header: ({ column }) => (
        <SortableHeader column={column} label={t("table.source")} />
      ),
      cell: ({ row }) => <SourceLabel source={row.original.source} />,
    }),
  ];
}
