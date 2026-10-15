"use client";

import { useId } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ReviewTheme } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { formatNumber, pluralize } from "@/lib/format";
import { reviewThemesOptions } from "@/lib/queries";
import { searchText } from "@/lib/search-text";
import { themesFilters, type ReviewView } from "./review-filters";

const THEMES_GUIDE =
  "https://docs.asobeast.com/guides/reviews#see-what-people-mention";

function themeDetail(theme: ReviewTheme, negativeScoreMax: number): string {
  return `in ${pluralize(theme.mentions, "review")}, ${formatNumber(theme.negative)} at ${pluralize(negativeScoreMax, "star")} or less`;
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
  const { data } = useSuspenseQuery(
    reviewThemesOptions(id, themesFilters(view)),
  );
  if (data.themes.length === 0) return null;
  const active = searchText(query);

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
          summary={`Phrases repeated in the newest ${pluralize(data.reviews, "review")} that match the filters. Phrases from reviews at ${pluralize(data.negativeScoreMax, "star")} or less come first. Pick one to search for it.`}
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
      <ul className="flex flex-wrap gap-1.5">
        {data.themes.map((theme) => {
          const selected = active === searchText(theme.phrase);
          return (
            <li key={theme.phrase}>
              <Button
                size="sm"
                variant={selected ? "default" : "outline"}
                aria-pressed={selected}
                onClick={() => onSelect(selected ? "" : theme.phrase)}
              >
                {theme.phrase}
                <span
                  aria-hidden
                  className={
                    selected ? "numeric" : "numeric text-muted-foreground"
                  }
                >
                  {formatNumber(theme.mentions)}
                </span>
                <span className="sr-only">
                  {themeDetail(theme, data.negativeScoreMax)}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
