"use client";

import { useTranslations } from "next-intl";
import { formatRankPosition } from "@asobeast/shared";
import type { KeywordComparisonRow } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { positionChipClass } from "@/components/keywords/PositionReadout";
import { Badge } from "@/components/ui/badge";
import { GradedNumber } from "@/components/ui/graded";
import { formatCountryInLocale, formatNumberInLocale } from "@/lib/format";
import { grade } from "@/lib/grade";
import { useAppLocale } from "@/lib/use-app-locale";
import { cn } from "@/lib/utils";
import { comparisonScore, type ComparisonScore } from "./comparison-scores";
import type { HeadToHead } from "./comparison-totals";

export interface MatrixCompetitor {
  id: string;
  name: string | null;
  iconUrl: string | null;
}

const POSITION_SLOT = "inline-flex h-6 min-w-9 items-center justify-center";
const BEST_POSITION = "underline decoration-2 underline-offset-4";

export function PositionCell({
  value,
  best,
  checked = true,
}: {
  value: number | null;
  best: boolean;
  checked?: boolean;
}) {
  const t = useTranslations("competitors");
  const graded = grade("position", value);
  if (!checked) {
    return (
      <span
        title={t("comparison.notChecked")}
        className={cn(POSITION_SLOT, "text-muted-foreground")}
      >
        <span aria-hidden>—</span>
        <span className="sr-only">{t("comparison.notChecked")}</span>
      </span>
    );
  }
  if (graded === null) {
    return (
      <span
        title={t("comparison.notRanking")}
        className={cn(POSITION_SLOT, "numeric text-muted-foreground")}
      >
        <span aria-hidden>{formatRankPosition(value)}</span>
        <span className="sr-only">{t("comparison.notRanking")}</span>
      </span>
    );
  }
  return (
    <GradedNumber
      value={formatRankPosition(value)}
      grade={graded}
      label={t("comparison.position")}
      marker={false}
      className={cn(positionChipClass(graded), best && BEST_POSITION)}
    />
  );
}

const SCORE_LABEL: Record<ComparisonScore, "popularity" | "difficulty"> = {
  traffic: "popularity",
  difficulty: "difficulty",
};

export function ScoreCell({
  row,
  score,
}: {
  row: KeywordComparisonRow;
  score: ComparisonScore;
}) {
  const t = useTranslations("competitors");
  const { label, grade: graded } = comparisonScore(row, score);
  return (
    <GradedNumber
      value={label}
      grade={graded}
      label={t(`comparison.${SCORE_LABEL[score]}`)}
      aligned
    />
  );
}

export const COMPARISON_SCORES: readonly ComparisonScore[] = [
  "traffic",
  "difficulty",
];

const SCORE_ABBR: Record<ComparisonScore, string> = {
  traffic: "P",
  difficulty: "D",
};

export function KeywordCell({
  row,
  scores,
  market,
  onOpenBreakdown,
}: {
  row: KeywordComparisonRow;
  scores: readonly ComparisonScore[];
  market: string | null;
  onOpenBreakdown: (keywordId: string, opener: HTMLElement) => void;
}) {
  const t = useTranslations("competitors");
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-2 font-medium">
        <button
          type="button"
          title={row.text}
          aria-label={t("comparison.whyRank", { keyword: row.text })}
          data-breakdown-keyword={row.keywordId}
          onClick={(event) =>
            onOpenBreakdown(row.keywordId, event.currentTarget)
          }
          className="max-w-32 truncate rounded-sm text-left font-medium underline decoration-muted-foreground decoration-dotted underline-offset-4 hover:decoration-foreground md:max-w-64"
        >
          {row.text}
        </button>
        {row.gap ? <Badge variant="flat">{t("comparison.gap")}</Badge> : null}
      </span>
      {market !== null || scores.length > 0 ? (
        <span className="flex items-center gap-2 text-caption text-muted-foreground">
          {market === null ? null : <MarketCell country={market} />}
          {scores.map((score) => (
            <span key={score}>
              <abbr aria-hidden title={t(`comparison.${SCORE_LABEL[score]}`)}>
                {SCORE_ABBR[score]}
              </abbr>{" "}
              <ScoreCell row={row} score={score} />
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}

export function MarketCell({ country }: { country: string }) {
  const locale = useAppLocale();
  const name = formatCountryInLocale(country, locale);
  return (
    <span title={name} className="text-label text-faint-foreground">
      <span aria-hidden>{country.toUpperCase()}</span>
      <span className="sr-only">{name}</span>
    </span>
  );
}

export const INLINE_HEADING_LIMIT = 3;

export function CompetitorHeading({
  competitor,
  stacked,
}: {
  competitor: MatrixCompetitor;
  stacked: boolean;
}) {
  const t = useTranslations("competitors");
  return (
    <span
      className={cn(
        "flex justify-end gap-x-2 gap-y-1",
        stacked ? "flex-col items-end md:w-20" : "items-center",
      )}
    >
      <span aria-hidden className="size-6 shrink-0">
        <AppIcon src={competitor.iconUrl} size={24} />
      </span>
      <span className="sr-only md:not-sr-only">
        <bdi
          className={cn(
            "block text-right",
            stacked
              ? "line-clamp-2 break-words whitespace-normal"
              : "max-w-40 truncate",
          )}
        >
          {competitor.name ?? t("unnamed")}
        </bdi>
      </span>
    </span>
  );
}

const TOTAL_FIGURE = "font-medium text-foreground";

export function TopTenTotal({ count }: { count: number }) {
  const t = useTranslations("competitors");
  const locale = useAppLocale();
  return (
    <span className="whitespace-nowrap">
      <span className={TOTAL_FIGURE}>
        {formatNumberInLocale(count, locale)}
      </span>{" "}
      <span>{t("comparison.inTop10")}</span>
    </span>
  );
}

export function HeadToHeadTotal({ totals }: { totals: HeadToHead }) {
  const t = useTranslations("competitors");
  const locale = useAppLocale();
  return (
    <span>
      <span
        aria-hidden
        className="flex flex-wrap justify-end gap-x-1 whitespace-nowrap"
      >
        <span>
          <span>{t("comparison.lead")}</span>
          <span className={TOTAL_FIGURE}>
            {formatNumberInLocale(totals.lead, locale)}
          </span>
          <span>,</span>
        </span>
        <span>
          <span>{t("comparison.trail")}</span>
          <span className={TOTAL_FIGURE}>
            {formatNumberInLocale(totals.trail, locale)}
          </span>
        </span>
      </span>
      <span className="sr-only">
        {t("comparison.headToHeadAria", {
          lead: totals.lead,
          trail: totals.trail,
        })}
      </span>
    </span>
  );
}
