"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { createTranslator } from "next-intl";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  CombinationField,
  CombinationStatus,
  KeywordCombination,
} from "@/lib/keyword-combinations";
import { oneOf } from "@/lib/table/facets";
import type { Locale } from "@/lib/locale";
import type { KeywordTableFeatures } from "./keyword-table-features";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export const COMBINATION_STATUS_LABELS: Record<CombinationStatus, string> = {
  tracked: enKeywords.combinations.status.tracked,
  paused: enKeywords.combinations.status.paused,
  untracked: enKeywords.combinations.status.untracked,
};

export const HIDDEN_COMBINATION_COLUMNS = { words: false };

export function combinationStatusLabel(
  status: CombinationStatus,
  t: MessageTranslator = english,
): string {
  return t(`combinations.status.${status}`);
}

export function wordCountLabel(
  count: number,
  t: MessageTranslator = english,
): string {
  return t("combinations.wordCount", { count });
}

function fieldLabels(
  fields: readonly CombinationField[],
  t: MessageTranslator,
  locale: Locale,
): string {
  return fields
    .map((field) => t(`combinations.fields.${field}`))
    .join(locale === "en" ? ", " : "、");
}

function StatusCell({
  combination,
  t,
}: {
  combination: KeywordCombination;
  t: MessageTranslator;
}) {
  const { phrase, status, trackedAs } = combination;
  return (
    <span className="flex items-center gap-2">
      {status === "untracked" ? (
        <span className="sr-only">{combinationStatusLabel(status, t)}</span>
      ) : (
        <span className="font-medium">{combinationStatusLabel(status, t)}</span>
      )}
      {trackedAs !== null && trackedAs !== phrase ? (
        <span className="text-caption text-muted-foreground">
          {t("combinations.trackedAs", { phrase: trackedAs })}
        </span>
      ) : null}
    </span>
  );
}

const columnHelper = createColumnHelper<
  KeywordTableFeatures,
  KeywordCombination
>();

export function combinationColumns(
  t: MessageTranslator = english,
  locale: Locale = "en",
) {
  return columnHelper.columns([
    columnHelper.display({
      id: "select",
      enableHiding: false,
      header: () => <span className="sr-only">{t("combinations.select")}</span>,
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={
            row.getCanSelect()
              ? t("table.selectOne", { keyword: row.original.phrase })
              : t("combinations.alreadyTracked", {
                  phrase: row.original.phrase,
                })
          }
        />
      ),
    }),
    columnHelper.accessor("phrase", {
      id: "phrase",
      header: () => <span>{t("combinations.phrase")}</span>,
      cell: ({ row }) => <span>{row.original.phrase}</span>,
    }),
    columnHelper.display({
      id: "fields",
      header: () => <span>{t("combinations.foundIn")}</span>,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {fieldLabels(row.original.fields, t, locale)}
        </span>
      ),
    }),
    columnHelper.accessor("status", {
      id: "status",
      header: () => <span>{t("combinations.statusTitle")}</span>,
      filterFn: (row, id, selected: CombinationStatus[]) =>
        oneOf(row.getValue<CombinationStatus>(id), selected),
      cell: ({ row }) => <StatusCell combination={row.original} t={t} />,
    }),
    columnHelper.accessor((row) => String(row.wordCount), {
      id: "words",
      enableHiding: false,
      filterFn: (row, id, selected: string[]) =>
        oneOf(row.getValue<string>(id), selected),
    }),
  ]);
}

export const COMBINATION_COLUMNS = combinationColumns();
