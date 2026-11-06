"use client";

import { useId } from "react";
import { RefreshCw } from "lucide-react";
import type { KeywordDiscoveryList } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { bulkLabels, rankedIds, recommendedIds } from "./discovery-actions";
import type { DiscoveryActions } from "./use-discovery-actions";

function BulkTrack({
  label,
  count,
  pending,
  onTrack,
}: {
  label: string;
  count: number;
  pending: boolean;
  onTrack: () => void;
}) {
  const inactive = pending || count === 0;
  return (
    <Button
      size="sm"
      variant="outline"
      aria-disabled={inactive || undefined}
      onClick={() => {
        if (!inactive) onTrack();
      }}
    >
      {label}
    </Button>
  );
}

export function DiscoveryToolbar({
  list,
  market,
  selected,
  actions,
}: {
  list: KeywordDiscoveryList;
  market: string;
  selected: readonly string[];
  actions: DiscoveryActions;
}) {
  const switchId = useId();
  const hintId = useId();
  const recommended = recommendedIds(list.items);
  const ranked = rankedIds(list.items);
  const labels = bulkLabels({
    selected: selected.length,
    recommended: recommended.length,
    ranked: list.counts.ranked,
  });
  const tracking = actions.track.isPending;
  const refreshing = actions.refresh.isPending;
  const switching = actions.settings.isPending;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-3">
        <Switch
          id={switchId}
          checked={list.autoTrackRanked}
          aria-describedby={hintId}
          aria-disabled={switching || undefined}
          onCheckedChange={(next) => {
            if (!switching) actions.settingsOnce(next);
          }}
        />
        <div className="flex flex-col">
          <Label htmlFor={switchId}>Auto-track ranked</Label>
          <span id={hintId} className="text-caption text-muted-foreground">
            Track every keyword the app ranks for, as soon as it is found
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
        <Button
          size="sm"
          variant="outline"
          aria-label="Refresh discoveries"
          aria-busy={refreshing || undefined}
          aria-disabled={refreshing || undefined}
          onClick={() => {
            if (!refreshing) actions.refreshOnce(undefined);
          }}
        >
          <RefreshCw
            aria-hidden
            className={cn(refreshing && "motion-safe:animate-spin")}
          />
          Refresh
        </Button>
        <BulkTrack
          label={labels.selected}
          count={selected.length}
          pending={tracking}
          onTrack={() =>
            actions.trackOnce({
              request: { keywordIds: [...selected] },
              removes: selected,
            })
          }
        />
        <BulkTrack
          label={labels.recommended}
          count={recommended.length}
          pending={tracking}
          onTrack={() =>
            actions.trackOnce({
              request: { keywordIds: recommended },
              removes: recommended,
            })
          }
        />
        <BulkTrack
          label={labels.ranked}
          count={list.counts.ranked}
          pending={tracking}
          onTrack={() =>
            actions.trackOnce({
              request: { allRanked: true, country: market },
              removes: ranked,
            })
          }
        />
      </div>
    </div>
  );
}
