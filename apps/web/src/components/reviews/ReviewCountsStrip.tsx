"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import type { ReviewReplyState } from "@asobeast/shared";
import { InfoTip } from "@/components/ui/info-tip";
import { StatTile, StatTileGroup } from "@/components/ui/stat-tile";
import { formatNumber } from "@/lib/format";
import { reviewsOptions } from "@/lib/queries";
import { COUNT_OF } from "@/lib/review-reply-cache";
import { countsFilters, type ReviewView } from "./review-filters";
import { REPLY_STATES_GUIDE, shownReplyStates } from "./reply-state";

export function ReviewCountsStrip({
  id,
  view,
  onSelect,
}: {
  id: string;
  view: ReviewView;
  onSelect: (state: ReviewReplyState | null) => void;
}) {
  const { data } = useSuspenseQuery(reviewsOptions(id, countsFilters(view)));
  const counts = data.counts;
  if (!counts) return null;
  const states = shownReplyStates(counts, view.replyState);

  return (
    <section aria-label="Reply status" className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <h2 className="text-label text-muted-foreground uppercase">
          Reply status
        </h2>
        <InfoTip
          label="About reply status"
          title="Reply status"
          summary="Needs reply: no reply anywhere. Draft saved: a reply is kept here and not marked. Replied: the store shows a reply, posted from here or in the console, or you marked the review as replied. Updated after reply: the reviewer edited the review after the Google Play reply, so read it again."
        >
          <a
            href={REPLY_STATES_GUIDE}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground underline decoration-primary underline-offset-4 hover:decoration-2"
          >
            Read how replies work
          </a>
        </InfoTip>
      </div>
      <StatTileGroup
        className={
          states.length > 3 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"
        }
      >
        {states.map(({ value, label }) => (
          <StatTile
            key={value}
            label={label}
            value={formatNumber(counts[COUNT_OF[value]])}
            selected={view.replyState === value}
            onSelect={() => onSelect(view.replyState === value ? null : value)}
          />
        ))}
      </StatTileGroup>
    </section>
  );
}
