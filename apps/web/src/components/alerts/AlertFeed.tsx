"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { isAlertFeedEvent } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAlertsSeen } from "@/components/layout/AlertsSeen";
import { PageHeader } from "@/components/layout/PageHeader";
import { FOOTER_LINK } from "@/components/layout/panel-classes";
import {
  alertEventFilters,
  alertEventsOptions,
  alertNewestOnVisitOptions,
} from "@/lib/queries";
import { cn } from "@/lib/utils";
import {
  AlertEventList,
  AlertFeedEnd,
  AlertFeedFooter,
  WHAT_THE_FEED_READS,
} from "./AlertEventList";
import { AlertFeedEmpty } from "./AlertFeedStates";
import {
  AlertFeedToolbar,
  CLEARED_ALERT_FEED,
  useAlertFeedView,
} from "./AlertFeedToolbar";
import {
  dayGroups,
  feedLede,
  searchEvents,
  type FeedLede,
} from "./alert-feed-view";

const ALERT_SETTINGS = "/settings#alerts";

function AlertFeedHeader({ lede }: { lede: FeedLede | null }) {
  return (
    <PageHeader
      title="Alerts"
      controls={
        <Link href={ALERT_SETTINGS} className={cn(FOOTER_LINK, "text-dense")}>
          Alert settings
        </Link>
      }
      lede={
        lede ? (
          <>
            {lede.figure ? (
              <span className="numeric font-medium text-foreground">
                {lede.figure}
              </span>
            ) : null}
            <span>{lede.rest}</span>
          </>
        ) : null
      }
    />
  );
}

function useFeedFilters() {
  const [view, setView] = useAlertFeedView();
  const app = useDeferredValue(view.app);
  const types = useDeferredValue(view.type.join(","));
  const query = useDeferredValue(view.q);
  const filters = useMemo(
    () =>
      alertEventFilters({
        app,
        type: types.split(",").filter(isAlertFeedEvent),
      }),
    [app, types],
  );
  return { filters, query, setView };
}

function useVisitMark(): string | null {
  const { seenAt, markSeen } = useAlertsSeen();
  const [seenAtVisit] = useState(seenAt);
  const newest = useQuery(alertNewestOnVisitOptions).data?.events[0]
    ?.occurredAt;
  useEffect(() => {
    if (newest) markSeen(newest);
  }, [newest, markSeen]);
  return seenAtVisit;
}

export function AlertFeed() {
  const seenAt = useVisitMark();
  const { filters, query, setView } = useFeedFilters();
  const searchBox = useRef<HTMLDivElement>(null);
  const feed = useSuspenseInfiniteQuery(alertEventsOptions(filters));
  const events = useMemo(
    () => feed.data.pages.flatMap((page) => page.events),
    [feed.data.pages],
  );
  const shown = useMemo(() => searchEvents(events, query), [events, query]);
  const filtered = Object.keys(filters).length > 0 || query.trim() !== "";
  const clearAll = () => {
    void setView(CLEARED_ALERT_FEED);
    searchBox.current?.querySelector("input")?.focus();
  };

  const recorded = events.length > 0;

  return (
    <>
      <AlertFeedHeader
        lede={
          recorded
            ? feedLede({ events, seenAt, hasMore: feed.hasNextPage })
            : null
        }
      />
      <AlertFeedToolbar
        shown={shown.length}
        loaded={events.length}
        hasMore={feed.hasNextPage}
        searchBox={searchBox}
        onClearAll={clearAll}
      />
      <Card className="gap-0 py-0">
        {shown.length === 0 ? (
          <AlertFeedEmpty
            filtered={filtered}
            searchedOnly={
              feed.hasNextPage && query.trim() !== "" ? events.length : null
            }
            action={
              <Button variant="outline" onClick={clearAll}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <AlertEventList
            groups={dayGroups(shown, feed.dataUpdatedAt)}
            seenAt={seenAt}
          />
        )}
        {recorded ? (
          <AlertFeedEnd
            hasMore={feed.hasNextPage}
            loading={feed.isFetchingNextPage}
            failed={feed.isFetchNextPageError}
            onLoadMore={() => feed.fetchNextPage({ cancelRefetch: false })}
          />
        ) : (
          <AlertFeedFooter>
            <p>{WHAT_THE_FEED_READS}</p>
          </AlertFeedFooter>
        )}
      </Card>
    </>
  );
}
