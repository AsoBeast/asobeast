"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { createTranslator } from "next-intl";
import type {
  KeywordImportRowResult,
  KeywordImportStatus,
} from "@asobeast/shared";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { Badge } from "@/components/ui/badge";
import {
  IMPORT_STATUS_VARIANT,
  importStatusLabel,
  rowNote,
} from "@/lib/keyword-import";
import { oneOf } from "@/lib/table/facets";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export interface PreviewRow extends KeywordImportRowResult {
  line: number;
}

const columnHelper = createColumnHelper<DataTableFeatures, PreviewRow>();

export function importColumns(
  lines: readonly number[],
  t: MessageTranslator = english,
) {
  return columnHelper.columns([
    columnHelper.accessor("line", {
      id: "line",
      header: () => <span>{t("import.line")}</span>,
      cell: ({ row }) => (
        <span className="numeric text-muted-foreground">
          {row.original.line}
        </span>
      ),
    }),
    columnHelper.accessor("keyword", {
      id: "keyword",
      header: () => <span>{t("import.keyword")}</span>,
      cell: ({ row }) => (
        <span className="whitespace-normal [overflow-wrap:anywhere]">
          {row.original.keyword}
        </span>
      ),
    }),
    columnHelper.accessor("country", {
      id: "country",
      header: () => <span>{t("import.market")}</span>,
      cell: ({ row }) => <span>{row.original.country.toUpperCase()}</span>,
    }),
    columnHelper.accessor("status", {
      id: "status",
      header: () => <span>{t("import.status")}</span>,
      filterFn: (row, id, selected: KeywordImportStatus[]) =>
        oneOf(row.getValue<KeywordImportStatus>(id), selected),
      cell: ({ row }) => (
        <Badge variant={IMPORT_STATUS_VARIANT[row.original.status]}>
          {importStatusLabel(row.original.status, t)}
        </Badge>
      ),
    }),
    columnHelper.display({
      id: "details",
      header: () => <span>{t("import.details")}</span>,
      cell: ({ row }) => (
        <span className="whitespace-normal text-muted-foreground">
          {rowNote(row.original, lines, t)}
        </span>
      ),
    }),
  ]);
}
