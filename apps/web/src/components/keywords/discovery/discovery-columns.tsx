"use client";

import { createColumnHelper } from "@tanstack/react-table";
import type {
  DiscoverySource,
  KeywordDiscoveryItem,
  Store,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { GradedNumber } from "@/components/ui/graded";
import { InfoTip } from "@/components/ui/info-tip";
import { grade } from "@/lib/grade";
import { discoverySourceLabel } from "@/lib/keyword-discoveries";
import { DiscoveryRowActions } from "./discovery-row-actions";
import type { KeywordTableFeatures } from "../keyword-table-features";
import {
  difficultyScore,
  opportunityScore,
  popularityScore,
  rankLabel,
  rankText,
  relevanceScore,
  type DiscoveryScore,
} from "./discovery-rows";

const DISCOVERY_GUIDE =
  "https://docs.asobeast.com/guides/keyword-discovery#how-the-rank-is-found";

const SOURCE_VARIANT: Record<
  DiscoverySource,
  "success" | "secondary" | "info" | "outline"
> = {
  title: "success",
  subtitle: "success",
  description: "success",
  competitors: "secondary",
  reviews: "secondary",
  popularity: "info",
  portfolio: "outline",
};

const columnHelper = createColumnHelper<
  KeywordTableFeatures,
  KeywordDiscoveryItem
>();

function Missing({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function ScoreValue({
  score,
  label,
}: {
  score: DiscoveryScore;
  label: string;
}) {
  return score.value === null ? (
    <Missing label={`No ${label.toLowerCase()} score`} />
  ) : (
    <GradedNumber value={`${score.value}`} grade={score.grade} label={label} />
  );
}

function RankCell({ item }: { item: KeywordDiscoveryItem }) {
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
      <span className="numeric font-mono text-muted-foreground">
        <span aria-hidden>{text}</span>
        <span className="sr-only">{rankLabel(item)}</span>
      </span>
    );
  }
  return (
    <GradedNumber
      value={text}
      grade={grade("position", item.position)}
      label="Rank"
    />
  );
}

function MetricHeader({
  label,
  title,
  summary,
}: {
  label: string;
  title: string;
  summary: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <InfoTip
        label={`About ${label.toLowerCase()}`}
        title={title}
        summary={summary}
      >
        <a
          href={DISCOVERY_GUIDE}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline decoration-primary underline-offset-4 hover:decoration-2"
        >
          Read about keyword discovery
        </a>
      </InfoTip>
    </span>
  );
}

const selectColumn = columnHelper.display({
  id: "select",
  enableHiding: false,
  header: () => <span className="sr-only">Select</span>,
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
  header: "Keyword",
  cell: ({ row }) => (
    <span className="flex flex-wrap items-center gap-2">
      <span className="font-medium wrap-anywhere">{row.original.text}</span>
      {row.original.recommended ? (
        <Badge variant="info">Recommended</Badge>
      ) : null}
    </span>
  ),
});

const sourceColumn = (store: Store) =>
  columnHelper.accessor("source", {
    id: "source",
    header: "Source",
    cell: ({ row }) => (
      <Badge variant={SOURCE_VARIANT[row.original.source]}>
        {discoverySourceLabel(row.original.source, store)}
      </Badge>
    ),
  });

const rankColumn = columnHelper.accessor("position", {
  id: "rank",
  header: () => (
    <MetricHeader
      label="Rank"
      title="Rank"
      summary="Where your app appears in the store search for this phrase. A rank up to 50 can come from another search made today or yesterday; a dash means not checked yet."
    />
  ),
  cell: ({ row }) => <RankCell item={row.original} />,
});

const scoreColumns = [
  columnHelper.accessor("volume", {
    id: "popularity",
    header: "Popularity",
    cell: ({ row }) => (
      <ScoreValue score={popularityScore(row.original)} label="Popularity" />
    ),
  }),
  columnHelper.accessor("difficulty", {
    id: "difficulty",
    header: "Difficulty",
    cell: ({ row }) => (
      <ScoreValue score={difficultyScore(row.original)} label="Difficulty" />
    ),
  }),
  columnHelper.accessor("relevance", {
    id: "relevance",
    header: () => (
      <MetricHeader
        label="Relevance"
        title="Relevance"
        summary="How relevant the phrase is to your listing, from where it was found and how many of its words your listing holds."
      />
    ),
    cell: ({ row }) => (
      <ScoreValue score={relevanceScore(row.original)} label="Relevance" />
    ),
  }),
  columnHelper.accessor("opportunity", {
    id: "opportunity",
    header: () => (
      <MetricHeader
        label="Opportunity"
        title="Opportunity"
        summary="Popularity weighed against difficulty. It needs both scores, which a keyword gets once it is tracked."
      />
    ),
    cell: ({ row }) => (
      <ScoreValue score={opportunityScore(row.original)} label="Opportunity" />
    ),
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
    rankColumn,
    ...scoreColumns,
    actionsColumn,
  ]);
