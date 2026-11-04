import type { Table } from "@tanstack/react-table";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { keywordTotals, type KeywordTotals } from "@/lib/keyword-totals";
import type { KeywordTableFeatures } from "./keyword-table-features";

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
      <span className="numeric font-mono">{lead}</span>
      {detail === undefined ? null : (
        <span className="text-caption text-muted-foreground">{detail}</span>
      )}
    </span>
  );
}

const countsOf = ({ ranked, notFound, unchecked }: KeywordTotals): string =>
  [
    `${ranked} ranked`,
    `${notFound} not found`,
    ...(unchecked > 0 ? [`${unchecked} not checked`] : []),
  ].join(", ");

export function keywordCountFooter({ table }: FooterContext) {
  const totals = totalsOf(table);
  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-medium">{`${totals.count} ${totals.count === 1 ? "keyword" : "keywords"}`}</span>
      <span className="text-caption text-muted-foreground">
        {countsOf(totals)}
      </span>
    </span>
  );
}

export function positionFooter({ table }: FooterContext) {
  const { averagePosition, topTen } = totalsOf(table);
  return averagePosition === null ? (
    <Missing label="No ranked keywords" />
  ) : (
    <Figures
      lead={`avg ${averagePosition}`}
      detail={`${topTen} in the top 10`}
    />
  );
}

function Average({ value }: { value: number | null }) {
  return value === null ? (
    <Missing label="No scored keywords" />
  ) : (
    <Figures lead={`avg ${value}`} />
  );
}

export function popularityFooter({ table }: FooterContext) {
  return <Average value={totalsOf(table).averagePopularity} />;
}

export function difficultyFooter({ table }: FooterContext) {
  return <Average value={totalsOf(table).averageDifficulty} />;
}
