"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useKeywordScope } from "@/components/app-detail/use-market";
import { MoversPanel } from "@/components/rankings/MoversPanel";
import { appDetailOptions, appSummaryOptions } from "@/lib/queries";
import { GapHeadline } from "./GapHeadline";

const MOVER_DAYS = 7;

export function MoversCard({ id }: { id: string }) {
  const { country } = useKeywordScope(id);
  const { data: summary } = useSuspenseQuery(appSummaryOptions(id, country));
  const { data: app } = useSuspenseQuery(appDetailOptions(id));
  const { up, down } = summary.movers;

  return (
    <MoversPanel
      movers={summary.movers}
      days={MOVER_DAYS}
      quiet={
        up.length + down.length > 0
          ? null
          : `No keyword moved in the last ${MOVER_DAYS} days.`
      }
      changeHeading={`${MOVER_DAYS}d change`}
      hrefOf={(mover) => `/apps/${id}/rankings?keywords=${mover.keywordId}`}
      lead={(mover) => (
        <span
          translate="no"
          className="truncate font-medium print:whitespace-normal"
        >
          {mover.text}
        </span>
      )}
      footer={
        app.isCompetitor ? null : <GapHeadline id={id} home={app.country} />
      }
    />
  );
}
