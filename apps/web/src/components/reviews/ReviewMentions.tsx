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
import {
  LIST_HEAD,
  PANEL_ACTION,
  PANEL_HEADER,
} from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { formatNumber, pluralize } from "@/lib/format";
import { reviewThemesOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { BREAKDOWN_BUTTON_ROW, BreakdownBar } from "./breakdown";
import { reviewFilters } from "./review-filters";
import { phraseQuery, quotedPhrase } from "./review-search";
import { themesSummary } from "./review-themes-summary";
import { useReviewView } from "./use-review-view";

const KIND_LABELS: Record<ReviewThemeKind, string> = {
  complaint: "Complaints",
  praise: "Praise",
};

const THEMES_GUIDE =
  "https://docs.asobeast.com/guides/reviews#see-what-people-mention";

const COLUMNS = "grid grid-cols-[minmax(0,1fr)_4.5rem] gap-3 px-2";

function themeDetail(theme: ReviewTheme, negativeScoreMax: number): string {
  return `in ${pluralize(theme.mentions, "review")}, ${formatNumber(theme.negative)} at ${pluralize(negativeScoreMax, "star")} or less`;
}

function ThemeRow({
  theme,
  share,
  negativeScoreMax,
  selected,
  onSelect,
}: {
  theme: ReviewTheme;
  share: number;
  negativeScoreMax: number;
  selected: boolean;
  onSelect: (phrase: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(selected ? "" : phraseQuery(theme.phrase))}
      className={cn(COLUMNS, BREAKDOWN_BUTTON_ROW)}
    >
      <BreakdownBar share={share} />
      <span className="relative truncate font-medium">{theme.phrase}</span>
      <span aria-hidden className="numeric relative text-right">
        {formatNumber(theme.mentions)}
      </span>
      <span className="sr-only">{themeDetail(theme, negativeScoreMax)}</span>
    </button>
  );
}

export function ReviewMentions({ id }: { id: string }) {
  const headingId = useId();
  const { view, query, setQuery } = useReviewView();
  const themes = useQuery(reviewThemesOptions(id, reviewFilters(view)));
  const { data } = themes;
  const failed = failedRead(themes);
  if (!failed && (!data || data.themes.length === 0)) return null;
  const active = quotedPhrase(query);
  const largest = Math.max(
    1,
    ...(data?.themes ?? []).map((theme) => theme.mentions),
  );

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>What people mention</h2>
          </CardTitle>
          {data ? (
            <CardAction className={PANEL_ACTION}>
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
                  className="font-medium text-foreground link-underline"
                >
                  Read how themes are found
                </a>
              </InfoTip>
            </CardAction>
          ) : null}
        </CardHeader>
        {data ? (
          <>
            <CardContent className="flex flex-col gap-1 px-2">
              <div aria-hidden className={cn(COLUMNS, LIST_HEAD)}>
                <span>Phrase</span>
                <span className="text-right">Reviews</span>
              </div>
              {REVIEW_THEME_KINDS.map((kind) => {
                const rows = data.themes.filter((theme) => theme.kind === kind);
                if (rows.length === 0) return null;
                const kindId = `${headingId}-${kind}`;
                return (
                  <div key={kind} className="flex flex-col">
                    <h3
                      id={kindId}
                      className="flex h-8 items-center px-2 text-label"
                    >
                      {KIND_LABELS[kind]}
                    </h3>
                    <ul
                      aria-labelledby={kindId}
                      className="flex list-none flex-col p-0"
                    >
                      {rows.map((theme) => (
                        <li key={theme.phrase}>
                          <ThemeRow
                            theme={theme}
                            share={theme.mentions / largest}
                            negativeScoreMax={data.negativeScoreMax}
                            selected={active === theme.phrase}
                            onSelect={(next) => void setQuery(next || null)}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </CardContent>
            <CardFooter>
              <span>
                {`From ${pluralize(data.reviews, "review")} matching the filters`}
              </span>
            </CardFooter>
          </>
        ) : (
          <CardContent>
            <InlineQueryError
              message="Could not load what people mention."
              read={themes}
            />
          </CardContent>
        )}
      </Card>
    </section>
  );
}
