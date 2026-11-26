import type { Table } from "@tanstack/react-table";
import { createTranslator } from "next-intl";
import type { TrackedKeywordItem } from "@asobeast/shared";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
import { keywordMoves } from "@/lib/keyword-day-change";
import { keywordTotals, type KeywordTotals } from "@/lib/keyword-totals";
import type { TrendState } from "@/lib/trend-window";
import type { KeywordTableFeatures } from "./keyword-table-features";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

type KeywordTable = Table<KeywordTableFeatures, TrackedKeywordItem>;

interface FooterContext {
  table: KeywordTable;
}

const totalsByRows = new WeakMap<object, KeywordTotals>();

function totalsOf(table: KeywordTable): KeywordTotals {
  const rows = table.getRowModel().rows;
  const known = totalsByRows.get(rows);
  if (known) return known;
  const totals = keywordTotals(rows.map((row) => row.original));
  totalsByRows.set(rows, totals);
  return totals;
}

function Missing({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function Figures({ lead, detail }: { lead: string; detail?: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="numeric">{lead}</span>
      {detail === undefined ? null : (
        <span className="text-caption text-muted-foreground">{detail}</span>
      )}
    </span>
  );
}

const countsOf = (
  { ranked, notFound, unchecked }: KeywordTotals,
  t: MessageTranslator,
): string => {
  const parts = [
    t("totals.ranked", { count: ranked }),
    t("totals.notFound", { count: notFound }),
    ...(unchecked > 0 ? [t("totals.notChecked", { count: unchecked })] : []),
  ];
  return parts.join(t("totals.separator"));
};

export function keywordCountFooter(
  { table }: FooterContext,
  t: MessageTranslator = english,
) {
  const totals = totalsOf(table);
  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-medium">
        {t("totals.keywords", { count: totals.count })}
      </span>
      <span className="text-caption text-muted-foreground">
        {countsOf(totals, t)}
      </span>
    </span>
  );
}

export function positionFooter(
  { table }: FooterContext,
  t: MessageTranslator = english,
) {
  const { averagePosition, topTen } = totalsOf(table);
  return averagePosition === null ? (
    <Missing label={t("totals.noRanked")} />
  ) : (
    <Figures
      lead={t("totals.average", { value: averagePosition })}
      detail={t("totals.topTen", { count: topTen })}
    />
  );
}

export function dayChangeFooter(
  { table }: FooterContext,
  today: string,
  t: MessageTranslator = english,
) {
  const { up, down, lost } = keywordMoves(
    table.getRowModel().rows.map((row) => row.original),
    today,
  );
  return (
    <Figures
      lead={t("totals.upDown", { up, down })}
      detail={t("totals.lost", { count: lost })}
    />
  );
}

function movesOver(
  table: KeywordTable,
  deltaOf: (keyword: TrackedKeywordItem) => number | null,
) {
  const deltas = table
    .getRowModel()
    .rows.map((row) => deltaOf(row.original))
    .filter((delta): delta is number => delta !== null);
  return {
    up: deltas.filter((delta) => delta < 0).length,
    down: deltas.filter((delta) => delta > 0).length,
  };
}

export function movedFooter(
  { table }: FooterContext,
  trend?: {
    deltaOf: (keyword: TrackedKeywordItem) => number | null;
    state: TrendState;
  },
  t: MessageTranslator = english,
) {
  if (trend && trend.state !== "ready") {
    return (
      <Missing
        label={
          trend.state === "pending"
            ? t("table.trendPending")
            : t("table.trendFailed")
        }
      />
    );
  }
  const { up, down } = trend
    ? movesOver(table, trend.deltaOf)
    : { up: totalsOf(table).movedUp7d, down: totalsOf(table).movedDown7d };
  return (
    <Figures
      lead={t("totals.up", { count: up })}
      detail={t("totals.down", { count: down })}
    />
  );
}

export function opportunityFooter(
  { table }: FooterContext,
  t: MessageTranslator = english,
) {
  return <Average value={totalsOf(table).averageOpportunity} t={t} />;
}

function Average({ value, t }: { value: number | null; t: MessageTranslator }) {
  return value === null ? (
    <Missing label={t("totals.noScored")} />
  ) : (
    <Figures lead={t("totals.average", { value })} />
  );
}

export function popularityFooter(
  { table }: FooterContext,
  t: MessageTranslator = english,
) {
  return <Average value={totalsOf(table).averagePopularity} t={t} />;
}

export function difficultyFooter(
  { table }: FooterContext,
  t: MessageTranslator = english,
) {
  return <Average value={totalsOf(table).averageDifficulty} t={t} />;
}
