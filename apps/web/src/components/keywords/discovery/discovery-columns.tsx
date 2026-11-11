"use client";

import { createColumnHelper } from "@tanstack/react-table";
import type { KeywordDiscoveryItem, Store } from "@asobeast/shared";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import { Checkbox } from "@/components/ui/checkbox";
import { GradedNumber } from "@/components/ui/graded";
import { InfoTip } from "@/components/ui/info-tip";
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

export const SELECT_ALL_DISCOVERIES = "Select all discovered keywords";

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
}: {
  value: number | null;
  label: string;
  metric: GradeMetric;
  emphasize?: boolean;
}) {
  return value === null ? (
    <Missing label={`No ${label.toLowerCase()} score`} />
  ) : (
    <ScoreReadout
      value={value}
      label={label}
      metric={metric}
      emphasize={emphasize}
    />
  );
}

function PositionValue({ item }: { item: KeywordDiscoveryItem }) {
  const text = rankText(item);
  if (text === null) {
    return (
      <span title="Not checked yet. The next weekly run or a refresh checks it.">
        <Missing label="Not checked yet" />
      </span>
    );
  }
  if (item.position === null) {
    return (
      <span className="numeric text-muted-foreground">
        <span aria-hidden>{text}</span>
        <span className="sr-only">{rankLabel(item)}</span>
      </span>
    );
  }
  const tier = grade("position", item.position);
  return (
    <GradedNumber
      value={text}
      grade={tier}
      label="Position"
      marker={false}
      className={positionChipClass(tier)}
    />
  );
}

function MetricTip({ label, summary }: { label: string; summary: string }) {
  return (
    <InfoTip
      label={`About ${label.toLowerCase()}`}
      title={label}
      summary={summary}
    >
      <a
        href={DISCOVERY_GUIDE}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground underline decoration-faint-foreground underline-offset-4 hover:decoration-2"
      >
        Read about keyword discovery
      </a>
    </InfoTip>
  );
}

const selectColumn = columnHelper.display({
  id: "select",
  enableHiding: false,
  header: ({ table }) => (
    <Checkbox
      checked={selectAllState(table)}
      onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
      aria-label={SELECT_ALL_DISCOVERIES}
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      data-discovery-select
      checked={row.getIsSelected()}
      onCheckedChange={(value) => row.toggleSelected(!!value)}
      aria-label={`Select ${row.original.text}`}
    />
  ),
});

const keywordColumn = columnHelper.accessor("text", {
  id: "keyword",
  sortFn: "text",
  sortDescFirst: false,
  header: ({ column }) => <SortableHeader column={column} label="Keyword" />,
  cell: ({ row }) => (
    <span className="flex flex-wrap items-center gap-x-2">
      <span className="font-medium wrap-anywhere">{row.original.text}</span>
      {row.original.recommended ? (
        <span className="text-label text-muted-foreground max-sm:hidden">
          Recommended
        </span>
      ) : null}
    </span>
  ),
});

const sourceColumn = (store: Store) =>
  columnHelper.accessor((row) => discoverySourceLabel(row.source, store), {
    id: "source",
    meta: { wideOnly: true },
    sortFn: "text",
    sortDescFirst: false,
    header: ({ column }) => <SortableHeader column={column} label="Source" />,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue()}</span>
    ),
  });

const positionColumn = columnHelper.accessor((row) => nullsLast(row.position), {
  id: "position",
  ...SORTABLE,
  sortDescFirst: false,
  header: ({ column }) => (
    <span className="inline-flex items-center gap-1">
      <SortableHeader column={column} label="Position" />
      <MetricTip
        label="Position"
        summary="Where your app appears in the store search for this phrase. A position up to 50 can come from another search made today or yesterday; a dash means not checked yet."
      />
    </span>
  ),
  cell: ({ row }) => <PositionValue item={row.original} />,
});

const scoreColumn = ({
  id,
  label,
  metric,
  value,
  summary,
  emphasize,
}: {
  id: string;
  label: string;
  metric: GradeMetric;
  value: (item: KeywordDiscoveryItem) => number | null;
  summary?: string;
  emphasize?: boolean;
}) =>
  columnHelper.accessor((row) => nullsLast(value(row)), {
    id,
    meta: { numeric: true },
    ...SORTABLE,
    sortDescFirst: true,
    header: ({ column }) => (
      <span className="inline-flex items-center gap-1">
        <SortableHeader column={column} label={label} />
        {summary ? <MetricTip label={label} summary={summary} /> : null}
      </span>
    ),
    cell: ({ row }) => (
      <ScoreValue
        value={value(row.original)}
        label={label}
        metric={metric}
        emphasize={emphasize}
      />
    ),
  });

const scoreColumns = [
  scoreColumn({
    id: "opportunity",
    label: "Opportunity",
    metric: "opportunity",
    value: (item) => shownScore(item.opportunity),
    summary:
      "Popularity weighed against difficulty. It needs both scores, which a keyword gets once it is tracked.",
    emphasize: true,
  }),
  scoreColumn({
    id: "popularity",
    label: "Popularity",
    metric: "popularity",
    value: (item) => shownScore(item.volume),
  }),
  scoreColumn({
    id: "difficulty",
    label: "Difficulty",
    metric: "difficulty",
    value: shownDifficulty,
  }),
  scoreColumn({
    id: "relevance",
    label: "Relevance",
    metric: "relevance",
    value: (item) => shownScore(item.relevance),
    summary:
      "How relevant the phrase is to your listing, from where it was found and how many of its words your listing holds.",
  }),
];

const actionsColumn = columnHelper.display({
  id: "actions",
  enableHiding: false,
  meta: { label: "Actions" },
  header: () => <span className="sr-only">Actions</span>,
  cell: ({ row }) => <DiscoveryRowActions item={row.original} />,
});

export const discoveryColumns = (store: Store) =>
  columnHelper.columns([
    selectColumn,
    keywordColumn,
    sourceColumn(store),
    positionColumn,
    ...scoreColumns,
    actionsColumn,
  ]);
