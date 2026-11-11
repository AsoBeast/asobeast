"use client";

import type { TrackedKeywordItem } from "@asobeast/shared";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import {
  KEYWORD_MOVE_FILTERS,
  matchesMoveFilter,
  MOVE_FILTER_LABELS,
  type KeywordMoveFilter,
} from "@/lib/keyword-day-change";

const EVERY = "all";

const isMoveFilter = (value: string): value is KeywordMoveFilter =>
  KEYWORD_MOVE_FILTERS.some((filter) => filter === value);

export function KeywordMoveSwitch({
  keywords,
  today,
  value,
  onChange,
}: {
  keywords: readonly TrackedKeywordItem[];
  today: string;
  value: KeywordMoveFilter | null;
  onChange: (next: KeywordMoveFilter | null) => void;
}) {
  return (
    <Tabs
      value={value ?? EVERY}
      onValueChange={(next) => onChange(isMoveFilter(next) ? next : null)}
    >
      <TabsList aria-label="Change since yesterday">
        <TabsOption value={EVERY}>
          <span>All</span>
        </TabsOption>
        {KEYWORD_MOVE_FILTERS.map((filter) => (
          <TabsOption key={filter} value={filter}>
            <span>{MOVE_FILTER_LABELS[filter]}</span>
            <span className="numeric text-muted-foreground">
              {`${keywords.filter((keyword) => matchesMoveFilter(keyword, today, filter)).length}`}
            </span>
          </TabsOption>
        ))}
      </TabsList>
    </Tabs>
  );
}
