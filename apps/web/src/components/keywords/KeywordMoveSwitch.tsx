"use client";

import type { TrackedKeywordItem } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import {
  KEYWORD_MOVE_FILTERS,
  matchesMoveFilter,
  moveFilterLabel,
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
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  return (
    <Tabs
      value={value ?? EVERY}
      onValueChange={(next) => onChange(isMoveFilter(next) ? next : null)}
    >
      <TabsList aria-label={t("filters.changeSinceYesterday")}>
        <TabsOption value={EVERY}>
          <span>{t("filters.allChanges")}</span>
        </TabsOption>
        {KEYWORD_MOVE_FILTERS.map((filter) => (
          <TabsOption key={filter} value={filter}>
            <span>{moveFilterLabel(filter, t)}</span>
            <span className="numeric text-muted-foreground">
              {formatNumberInLocale(
                keywords.filter((keyword) =>
                  matchesMoveFilter(keyword, today, filter),
                ).length,
                locale,
              )}
            </span>
          </TabsOption>
        ))}
      </TabsList>
    </Tabs>
  );
}
