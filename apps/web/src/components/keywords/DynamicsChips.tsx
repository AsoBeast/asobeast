"use client";

import { keywordLabel, type TrackedKeywordItem } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { RankingChartData } from "@/components/charts/pivot";

export const dynamicsChipId = (keywordId: string): string =>
  `keyword-dynamics-chip-${keywordId}`;

export function DynamicsChips({
  selected,
  tracked,
  chart,
  onRemove,
}: {
  selected: readonly string[];
  tracked: readonly TrackedKeywordItem[];
  chart: RankingChartData;
  onRemove: (keywordId: string, trigger: HTMLElement) => void;
}) {
  const t = useTranslations("keywords");
  const labels = new Map(
    tracked.map((item) => [item.keywordId, keywordLabel(item)]),
  );
  return (
    <div
      role="group"
      aria-label={t("dynamics.selected")}
      className="flex flex-wrap items-center gap-2"
    >
      {selected.map((keywordId) => (
        <button
          key={keywordId}
          type="button"
          id={dynamicsChipId(keywordId)}
          aria-label={t("dynamics.remove", {
            keyword: labels.get(keywordId) ?? keywordId,
          })}
          onClick={(event) => onRemove(keywordId, event.currentTarget)}
          className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-label hover:bg-muted"
        >
          <span
            data-swatch
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: chart.config[keywordId]?.color }}
          />
          <span className="max-w-40 truncate">
            {labels.get(keywordId) ?? keywordId}
          </span>
          <X className="size-3 opacity-60" aria-hidden />
        </button>
      ))}
    </div>
  );
}
