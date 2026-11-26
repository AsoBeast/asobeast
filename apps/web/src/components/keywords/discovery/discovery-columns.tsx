"use client";

import { createColumnHelper } from "@tanstack/react-table";
import type { KeywordDiscoveryItem, Store } from "@asobeast/shared";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import { Checkbox } from "@/components/ui/checkbox";
import { GradedNumber } from "@/components/ui/graded";
import { InfoTip } from "@/components/ui/info-tip";
import type { MessageTranslator } from "@/i18n/translator";
import { grade, type GradeMetric } from "@/lib/grade";
import { discoverySourceLabel } from "@/lib/keyword-discoveries";
import { nullsLast } from "@/lib/table/sorting";
import { SORTABLE } from "../keyword-column-helper";
import type { KeywordTableFeatures } from "../keyword-table-features";
import { positionChipClass } from "../PositionReadout";
import { ScoreReadout } from "../score-cells";
import { DiscoveryRowActions } from "./discovery-row-actions";
import {
  rankLabel,
  rankText,
  shownDifficulty,
  shownScore,
} from "./discovery-rows";

const DISCOVERY_GUIDE =
  "https://docs.asobeast.com/guides/keyword-discovery#how-the-rank-is-found";

const columnHelper = createColumnHelper<
  KeywordTableFeatures,
  KeywordDiscoveryItem
>();

function selectAllState(table: {
  getIsAllRowsSelected: () => boolean;
  getIsSomeRowsSelected: () => boolean;
}): boolean | "indeterminate" {
  if (table.getIsAllRowsSelected()) return true;
  return table.getIsSomeRowsSelected() ? "indeterminate" : false;
}

function Missing({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function ScoreValue({
  value,
  label,
  metric,
  emphasize,
  t,
}: {
  value: number | null;
  label: string;
  metric: GradeMetric;
  emphasize?: boolean;
  t: MessageTranslator;
}) {
  return value === null ? (
    <Missing
      label={t("discovery.columns.noScore", { label: label.toLowerCase() })}
    />
  ) : (
    <ScoreReadout
      value={value}
      label={label}
      metric={metric}
      emphasize={emphasize}
    />
  );
}

function NarrowOpportunity({
  value,
  t,
}: {
  value: number | null;
  t: MessageTranslator;
}) {
  if (value === null) return null;
  return (
    <span className="flex basis-full items-center gap-1.5 text-caption sm:hidden">
      <span aria-hidden className="text-muted-foreground">
        {t("discovery.columns.opportunity")}
      </span>
      <GradedNumber
        value={`${value}`}
        grade={grade("opportunity", value)}
        label={t("discovery.columns.opportunity")}
      />
    </span>
  );
}

function PositionValue({
  item,
  t,
}: {
  item: KeywordDiscoveryItem;
  t: MessageTranslator;
}) {
  const text = rankText(item);
  if (text === null) {
    return (
      <span title={t("discovery.columns.positionSummary")}>
        <Missing label={t("discovery.columns.notChecked")} />
      </span>
    );
  }
  if (item.position === null) {
    return (
      <span className="numeric text-muted-foreground">
        <span aria-hidden>{text}</span>
        <span className="sr-only">{rankLabel(item, t)}</span>
      </span>
    );
  }
  const tier = grade("position", item.position);
  return (
    <GradedNumber
      value={text}
      grade={tier}
      label={rankLabel(item, t)}
      marker={false}
      className={positionChipClass(tier)}
    />
  );
}

function MetricTip({
  label,
  summary,
  t,
}: {
  label: string;
  summary: string;
  t: MessageTranslator;
}) {
  return (
    <InfoTip
      label={t("discovery.columns.about", { label: label.toLowerCase() })}
      title={label}
      summary={summary}
    >
      <a
        href={DISCOVERY_GUIDE}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground link-underline"
      >
        {t("discovery.columns.read")}
      </a>
    </InfoTip>
  );
}

const selectColumn = (t: MessageTranslator) =>
  columnHelper.display({
    id: "select",
    enableHiding: false,
    header: ({ table }) => (
      <Checkbox
        checked={selectAllState(table)}
        onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
        aria-label={t("discovery.columns.selectAll")}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        data-discovery-select
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label={t("discovery.columns.select", {
          keyword: row.original.text,
        })}
      />
    ),
  });

const keywordColumn = (t: MessageTranslator) =>
  columnHelper.accessor("text", {
    id: "keyword",
    sortFn: "text",
    sortDescFirst: false,
    header: ({ column }) => (
      <SortableHeader column={column} label={t("discovery.columns.keyword")} />
    ),
    cell: ({ row }) => (
      <span className="flex min-w-28 flex-wrap items-center gap-x-2 leading-tight">
        <span className="font-medium wrap-anywhere">{row.original.text}</span>
        {row.original.recommended ? (
          <span className="text-label text-muted-foreground max-sm:hidden">
            {t("discovery.columns.recommended")}
          </span>
        ) : null}
        <NarrowOpportunity value={shownScore(row.original.opportunity)} t={t} />
      </span>
    ),
  });

const sourceColumn = (store: Store, t: MessageTranslator) =>
  columnHelper.accessor((row) => discoverySourceLabel(row.source, store, t), {
    id: "source",
    meta: { wideOnly: true },
    sortFn: "text",
    sortDescFirst: false,
    header: ({ column }) => (
      <SortableHeader column={column} label={t("discovery.columns.source")} />
    ),
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue()}</span>
    ),
  });

const positionColumn = (t: MessageTranslator) =>
  columnHelper.accessor((row) => nullsLast(row.position), {
    id: "position",
    ...SORTABLE,
    sortDescFirst: false,
    header: ({ column }) => (
      <span className="inline-flex items-center gap-1">
        <SortableHeader
          column={column}
          label={t("discovery.columns.position")}
        />
        <MetricTip
          label={t("discovery.columns.position")}
          summary={t("discovery.columns.positionSummary")}
          t={t}
        />
      </span>
    ),
    cell: ({ row }) => <PositionValue item={row.original} t={t} />,
  });

const scoreColumn = ({
  id,
  label,
  metric,
  value,
  summary,
  emphasize,
  t,
}: {
  id: string;
  label: string;
  metric: GradeMetric;
  value: (item: KeywordDiscoveryItem) => number | null;
  summary?: string;
  emphasize?: boolean;
  t: MessageTranslator;
}) =>
  columnHelper.accessor((row) => nullsLast(value(row)), {
    id,
    meta: { numeric: true, wideOnly: true },
    ...SORTABLE,
    sortDescFirst: true,
    header: ({ column }) => (
      <span className="inline-flex items-center gap-1">
        <SortableHeader column={column} label={label} />
        {summary ? <MetricTip label={label} summary={summary} t={t} /> : null}
      </span>
    ),
    cell: ({ row }) => (
      <ScoreValue
        value={value(row.original)}
        label={label}
        metric={metric}
        emphasize={emphasize}
        t={t}
      />
    ),
  });

const scoreColumns = (t: MessageTranslator) => [
  scoreColumn({
    id: "opportunity",
    label: t("discovery.columns.opportunity"),
    metric: "opportunity",
    value: (item) => shownScore(item.opportunity),
    summary: t("discovery.columns.opportunitySummary"),
    emphasize: true,
    t,
  }),
  scoreColumn({
    id: "popularity",
    label: t("discovery.columns.popularity"),
    metric: "popularity",
    value: (item) => shownScore(item.volume),
    t,
  }),
  scoreColumn({
    id: "difficulty",
    label: t("discovery.columns.difficulty"),
    metric: "difficulty",
    value: shownDifficulty,
    t,
  }),
  scoreColumn({
    id: "relevance",
    label: t("discovery.columns.relevance"),
    metric: "relevance",
    value: (item) => shownScore(item.relevance),
    summary: t("discovery.columns.relevanceSummary"),
    t,
  }),
];

const actionsColumn = (t: MessageTranslator) =>
  columnHelper.display({
    id: "actions",
    enableHiding: false,
    meta: { label: t("discovery.columns.actions") },
    header: () => (
      <span className="sr-only">{t("discovery.columns.actions")}</span>
    ),
    cell: ({ row }) => <DiscoveryRowActions item={row.original} />,
  });

export const discoveryColumns = (store: Store, t: MessageTranslator) =>
  columnHelper.columns([
    selectColumn(t),
    keywordColumn(t),
    sourceColumn(store, t),
    positionColumn(t),
    ...scoreColumns(t),
    actionsColumn(t),
  ]);
