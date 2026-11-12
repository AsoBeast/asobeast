"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { isAlertFeedEvent } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { useAlertsSeen } from "@/components/layout/AlertsSeen";
import {
  alertEventFilters,
  alertEventsOptions,
  alertNewestOnVisitOptions,
} from "@/lib/queries";
import { AlertEventList, AlertFeedEnd } from "./AlertEventList";
import { AlertFeedEmpty } from "./AlertFeedStates";
import {
  AlertFeedToolbar,
  CLEARED_ALERT_FEED,
  useAlertFeedView,
} from "./AlertFeedToolbar";
import { dayGroups, searchEvents } from "./alert-feed-view";

const ALERTS_GUIDE =
  "https://docs.asobeast.com/guides/alerts#see-what-the-run-detected";

const WHAT_THE_PAGE_LISTS =
  "Every event the daily run detected for your apps in the last 30 days, whether or not an alert channel is subscribed. Delivery is separate: channels are set up in Settings.";

function AlertFeedHeader() {
  return (
    <header className="flex items-center gap-2">
      <h1 className="text-title tracking-tight text-balance">Alerts</h1>
      <InfoTip
        label="About the alerts page"
        title="What the alerts page lists"
        summary={WHAT_THE_PAGE_LISTS}
      >
        <a
          href={ALERTS_GUIDE}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline decoration-faint-foreground underline-offset-4 hover:decoration-foreground"
        >
          Read how alerts work
        </a>
      </InfoTip>
    </header>
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

  return (
    <>
      <AlertFeedHeader />
      <AlertFeedToolbar
        shown={shown.length}
        loaded={events.length}
        hasMore={feed.hasNextPage}
        searchBox={searchBox}
        onClearAll={clearAll}
      />
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
      {events.length === 0 ? null : (
        <AlertFeedEnd
          hasMore={feed.hasNextPage}
          loading={feed.isFetchingNextPage}
          failed={feed.isFetchNextPageError}
          onLoadMore={() => feed.fetchNextPage({ cancelRefetch: false })}
        />
      )}
    </>
  );
}
