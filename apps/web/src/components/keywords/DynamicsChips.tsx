"use client";

import { keywordLabel, type TrackedKeywordItem } from "@asobeast/shared";
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
  const labels = new Map(
    tracked.map((item) => [item.keywordId, keywordLabel(item)]),
  );
  return (
    <div
      role="group"
      aria-label="Selected keywords"
      className="flex flex-wrap items-center gap-2"
    >
      {selected.map((keywordId) => (
        <button
          key={keywordId}
          type="button"
          id={dynamicsChipId(keywordId)}
          aria-label={`Remove ${labels.get(keywordId) ?? keywordId} from the chart`}
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
