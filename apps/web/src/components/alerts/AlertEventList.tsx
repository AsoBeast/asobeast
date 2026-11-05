"use client";

import { useRef } from "react";
import type { AlertEventItem } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { isNewSince } from "@/lib/alerts-seen";
import { useFocusAfterCommit } from "@/lib/focus-handoff";
import { AlertEventRow } from "./AlertEventRow";
import type { DayGroup } from "./alert-feed-view";

export function AlertEventList({
  groups,
  now,
  seenAt,
}: {
  groups: readonly DayGroup[];
  now: number;
  seenAt: string | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group, index) => {
        const headingId = `alerts-day-${index}-${group.key}`;
        return (
          <section
            key={`${index}-${group.key}`}
            aria-labelledby={headingId}
            className="flex flex-col gap-2"
          >
            <h2
              id={headingId}
              className="text-label text-muted-foreground uppercase"
            >
              {`${group.label} · ${group.events.length}`}
            </h2>
            <ul className="flex list-none flex-col gap-2 p-0">
              {group.events.map((item: AlertEventItem) => (
                <AlertEventRow
                  key={item.id}
                  item={item}
                  now={now}
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

export function AlertFeedEnd({
  hasMore,
  loading,
  onLoadMore,
}: {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => Promise<unknown>;
}) {
  const footer = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const handOffFocus = useFocusAfterCommit();

  const loadMore = () => {
    if (loading) return;
    handOffFocus(footer.current, button.current);
    void onLoadMore();
  };

  return (
    <div
      ref={footer}
      data-slot="feed-end"
      tabIndex={-1}
      className="flex justify-center rounded-lg py-2 outline-none"
    >
      {hasMore ? (
        <Button
          ref={button}
          variant="outline"
          aria-disabled={loading || undefined}
          onClick={loadMore}
        >
          Load more
        </Button>
      ) : (
        <p className="text-caption text-muted-foreground">
          That is every event of the last 30 days.
        </p>
      )}
    </div>
  );
}
