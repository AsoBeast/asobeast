"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { utcDayOf } from "@asobeast/shared";
import { LEDE } from "@/components/layout/panel-classes";
import { keywordCountriesOptions, keywordsOptions } from "@/lib/queries";
import { keywordMoves, movesSentence } from "./keyword-moves";

const FIGURE = "numeric font-medium text-foreground";

export function TrackedSummary({ id, market }: { id: string; market: string }) {
  const { data: markets } = useSuspenseQuery(keywordCountriesOptions(id));
  const { data: keywords, dataUpdatedAt } = useSuspenseQuery(
    keywordsOptions(id, market),
  );
  const total = markets.reduce((sum, entry) => sum + entry.keywordCount, 0);
  const active = keywords.filter((keyword) => keyword.active).length;
  const moves = keywordMoves(keywords, utcDayOf(dataUpdatedAt));

  return (
    <p className={LEDE} aria-live="polite">
      <span>
        Tracking <span className={FIGURE}>{keywords.length}</span>
        {keywords.length === total ? null : (
          <span>
            {" of "}
            <span className={FIGURE}>{total}</span>
          </span>
        )}
        <span>{` keyword${keywords.length === 1 ? "" : "s"} · `}</span>
        <span className={FIGURE}>{active}</span> active
      </span>
      {keywords.length > 0 ? <span>{`. ${movesSentence(moves)}`}</span> : null}
    </p>
  );
}
