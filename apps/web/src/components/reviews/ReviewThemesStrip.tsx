"use client";

import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  REVIEW_THEME_KINDS,
  type ReviewTheme,
  type ReviewThemeKind,
} from "@asobeast/shared";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { formatNumber, pluralize } from "@/lib/format";
import { reviewThemesOptions } from "@/lib/queries";
import { reviewFilters, type ReviewView } from "./review-filters";
import { phraseQuery, quotedPhrase } from "./review-search";
import { themesSummary } from "./review-themes-summary";

const KIND_LABELS: Record<ReviewThemeKind, string> = {
  complaint: "Complaints",
  praise: "Praise",
};

const THEMES_GUIDE =
  "https://docs.asobeast.com/guides/reviews#see-what-people-mention";

function themeDetail(theme: ReviewTheme, negativeScoreMax: number): string {
  return `in ${pluralize(theme.mentions, "review")}, ${formatNumber(theme.negative)} at ${pluralize(negativeScoreMax, "star")} or less`;
}

function ThemeChip({
  theme,
  negativeScoreMax,
  selected,
  onSelect,
}: {
  theme: ReviewTheme;
  negativeScoreMax: number;
  selected: boolean;
  onSelect: (phrase: string) => void;
}) {
  return (
    <Button
      size="sm"
      variant={selected ? "default" : "outline"}
      aria-pressed={selected}
      onClick={() => onSelect(selected ? "" : phraseQuery(theme.phrase))}
    >
      {theme.phrase}
      <span
        aria-hidden
        className={selected ? "numeric" : "numeric text-muted-foreground"}
      >
        {formatNumber(theme.mentions)}
      </span>
      <span className="sr-only">{themeDetail(theme, negativeScoreMax)}</span>
    </Button>
  );
}

export function ReviewThemesStrip({
  id,
  view,
  query,
  onSelect,
}: {
  id: string;
  view: ReviewView;
  query: string;
  onSelect: (phrase: string) => void;
}) {
  const headingId = useId();
  const themes = useQuery(reviewThemesOptions(id, reviewFilters(view)));
  const { data } = themes;
  if (failedRead(themes)) {
    return (
      <InlineQueryError
        message="Could not load what people mention."
        read={themes}
      />
    );
  }
  if (!data || data.themes.length === 0) return null;
  const active = quotedPhrase(query);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <h2
          id={headingId}
          className="text-label text-muted-foreground uppercase"
        >
          What people mention
        </h2>
        <InfoTip
          label="About what people mention"
          title="What people mention"
          summary={themesSummary({
            negativeScoreMax: data.negativeScoreMax,
            reviews: data.reviews,
            sort: view.sort,
          })}
        >
          <a
            href={THEMES_GUIDE}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground underline decoration-primary underline-offset-4 hover:decoration-2"
          >
            Read how themes are found
          </a>
        </InfoTip>
      </div>
      {REVIEW_THEME_KINDS.map((kind) => {
        const themes = data.themes.filter((theme) => theme.kind === kind);
        if (themes.length === 0) return null;
        return (
          <div key={kind} className="flex flex-wrap items-center gap-1.5">
            <span
              id={`${headingId}-${kind}`}
              className="w-20 shrink-0 text-caption text-muted-foreground"
            >
              {KIND_LABELS[kind]}
            </span>
            <ul
              aria-labelledby={`${headingId}-${kind}`}
              className="flex flex-wrap gap-1.5"
            >
              {themes.map((theme) => (
                <li key={theme.phrase}>
                  <ThemeChip
                    theme={theme}
                    negativeScoreMax={data.negativeScoreMax}
                    selected={active === theme.phrase}
                    onSelect={onSelect}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
