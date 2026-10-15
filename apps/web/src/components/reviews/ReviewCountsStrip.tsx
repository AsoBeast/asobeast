"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import type { ReviewReplyState } from "@asobeast/shared";
import { InfoTip } from "@/components/ui/info-tip";
import { StatTile, StatTileGroup } from "@/components/ui/stat-tile";
import { formatNumber } from "@/lib/format";
import { reviewsOptions } from "@/lib/queries";
import { COUNT_OF } from "@/lib/review-reply-cache";
import { countsFilters, type ReviewView } from "./review-filters";
import { REPLY_STATE_OPTIONS, REPLY_STATES_GUIDE } from "./reply-state";

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

  return (
    <section aria-label="Reply status" className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <h2 className="text-label text-muted-foreground uppercase">
          Reply status
        </h2>
        <InfoTip
          label="About reply status"
          title="Reply status"
          summary="Needs reply: no reply anywhere. Draft saved: a reply is kept here and not marked. Replied: Google Play shows a developer reply, or you marked the review as replied."
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
      <StatTileGroup>
        {REPLY_STATE_OPTIONS.map(({ value, label }) => (
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
