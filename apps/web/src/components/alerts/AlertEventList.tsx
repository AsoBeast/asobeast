"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { isNewSince } from "@/lib/alerts-seen";
import { useFocusAfterCommit } from "@/lib/focus-handoff";
import { AlertEventRow } from "./AlertEventRow";
import type { DayGroup } from "./alert-feed-view";

export function AlertEventList({
  groups,
  seenAt,
}: {
  groups: readonly DayGroup[];
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
            <h2 id={headingId} className="text-label text-muted-foreground">
              {`${group.label} · ${group.events.length}`}
            </h2>
            <ul className="flex list-none flex-col gap-2 p-0">
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
      className="flex flex-col items-center gap-2 rounded-lg py-2 outline-none"
    >
      {failed && !loading ? (
        <p role="alert" className="text-caption text-destructive">
          More events could not be loaded. Try again.
        </p>
      ) : null}
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
