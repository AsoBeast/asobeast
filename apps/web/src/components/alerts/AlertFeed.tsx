"use client";

import { useDeferredValue, useMemo } from "react";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { isAlertFeedEvent } from "@asobeast/shared";
import { InfoTip } from "@/components/ui/info-tip";
import { alertEventFilters, alertEventsOptions } from "@/lib/queries";
import { alertFeedParsers } from "@/lib/search-params";
import { AlertEventList, AlertFeedEnd } from "./AlertEventList";
import { AlertFeedEmpty } from "./AlertFeedStates";
import { dayGroups, searchEvents } from "./alert-feed-view";

const ALERTS_GUIDE = "https://docs.asobeast.com/guides/alerts";

const WHAT_THE_PAGE_LISTS =
  "Every event the daily run detected for your apps in the last 30 days, whether or not an alert channel is subscribed. Delivery is separate: channels are set up in Settings.";

function AlertFeedHeader() {
  return (
    <header className="flex items-center gap-2">
      <h1 className="text-display tracking-tight text-balance">Alerts</h1>
      <InfoTip
        label="About the alerts page"
        title="What the alerts page lists"
        summary={WHAT_THE_PAGE_LISTS}
      >
        <a
          href={ALERTS_GUIDE}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline decoration-primary underline-offset-4 hover:decoration-2"
        >
          Read how alerts work
        </a>
      </InfoTip>
    </header>
  );
}

function useFeedFilters() {
  const [view] = useQueryStates(alertFeedParsers);
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
  return { filters, query };
}

export function AlertFeed() {
  const { filters, query } = useFeedFilters();
  const feed = useSuspenseInfiniteQuery(alertEventsOptions(filters));
  const events = useMemo(
    () => feed.data.pages.flatMap((page) => page.events),
    [feed.data.pages],
  );
  const shown = useMemo(() => searchEvents(events, query), [events, query]);
  const now = feed.dataUpdatedAt;
  const filtered = Object.keys(filters).length > 0 || query.trim() !== "";

  return (
    <>
      <AlertFeedHeader />
      {shown.length === 0 ? (
        <AlertFeedEmpty filtered={filtered} />
      ) : (
        <AlertEventList groups={dayGroups(shown, now)} now={now} />
      )}
      {events.length === 0 ? null : (
        <AlertFeedEnd
          hasMore={feed.hasNextPage}
          loading={feed.isFetchingNextPage}
          onLoadMore={() => feed.fetchNextPage({ cancelRefetch: false })}
        />
      )}
    </>
  );
}
