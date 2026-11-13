"use client";

import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { FOOTER_LINK } from "@/components/layout/panel-classes";
import { isNewSince } from "@/lib/alerts-seen";
import { useFocusAfterCommit } from "@/lib/focus-handoff";
import { AlertEventRow } from "./AlertEventRow";
import type { DayGroup } from "./alert-feed-view";
import { ALERT_DAY, ALERT_DAY_HEADING, ALERT_ROWS } from "./alert-row-classes";

const ALERTS_GUIDE =
  "https://docs.asobeast.com/guides/alerts#see-what-the-run-detected";

export const WHAT_THE_FEED_READS =
  "Last 30 days, newest first. Events are recorded whether or not a channel delivers them.";

export function AlertEventList({
  groups,
  seenAt,
}: {
  groups: readonly DayGroup[];
  seenAt: string | null;
}) {
  return (
    <div>
      {groups.map((group, index) => {
        const headingId = `alerts-day-${index}-${group.key}`;
        return (
          <section
            key={`${index}-${group.key}`}
            aria-labelledby={headingId}
            className={ALERT_DAY}
          >
            <h2 id={headingId} className={ALERT_DAY_HEADING}>
              <span>
                <span>{group.label}</span>
                <span className="text-faint-foreground">{` · ${group.events.length}`}</span>
              </span>
            </h2>
            <ul className={ALERT_ROWS}>
              {group.events.map((item) => (
                <AlertEventRow
                  key={item.id}
                  item={item}
                  isNew={isNewSince(item.occurredAt, seenAt)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function AlertFeedFooter({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <CardFooter className="flex-wrap justify-between gap-x-4 gap-y-2">
      {children}
      <div className="flex items-center gap-4">
        <a
          href={ALERTS_GUIDE}
          target="_blank"
          rel="noreferrer"
          className={FOOTER_LINK}
        >
          How alerts work
        </a>
        {action}
      </div>
    </CardFooter>
  );
}

export function AlertFeedEnd({
  hasMore,
  loading,
  failed,
  onLoadMore,
}: {
  hasMore: boolean;
  loading: boolean;
  failed: boolean;
  onLoadMore: () => Promise<unknown>;
}) {
  const end = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const handOffFocus = useFocusAfterCommit();

  const loadMore = () => {
    if (loading) return;
    handOffFocus(end.current, button.current);
    void onLoadMore();
  };

  return (
    <AlertFeedFooter
      action={
        hasMore ? (
          <Button
            ref={button}
            variant="outline"
            size="sm"
            aria-disabled={loading || undefined}
            onClick={loadMore}
          >
            Load more
          </Button>
        ) : null
      }
    >
      <div
        ref={end}
        data-slot="feed-end"
        tabIndex={-1}
        className="flex min-w-0 flex-col gap-1 rounded-sm outline-none"
      >
        {failed && !loading ? (
          <p role="alert" className="text-destructive">
            More events could not be loaded. Try again.
          </p>
        ) : null}
        <p>
          {hasMore
            ? WHAT_THE_FEED_READS
            : "That is every event of the last 30 days."}
        </p>
      </div>
    </AlertFeedFooter>
  );
}
