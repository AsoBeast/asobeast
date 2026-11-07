"use client";

import type { RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import {
  ALERT_FEED_EVENTS,
  type AlertFeedEvent,
  type AppListItem,
} from "@asobeast/shared";
import { FacetFilter } from "@/components/data-table/FacetFilter";
import {
  FilterChips,
  type FilterChip,
} from "@/components/data-table/FilterChips";
import { RowCount } from "@/components/data-table/RowCount";
import { SearchInput } from "@/components/data-table/SearchInput";
import { EVENT_LABELS } from "@/components/settings/alert-event-copy";
import { storeLabel } from "@/lib/format";
import { appsOptions } from "@/lib/queries";
import { alertFeedParsers } from "@/lib/search-params";
import { useHydrated } from "@/lib/use-hydrated";

export const useAlertFeedView = () => useQueryStates(alertFeedParsers);

type AlertFeedView = ReturnType<typeof useAlertFeedView>[0];
type SetAlertFeedView = ReturnType<typeof useAlertFeedView>[1];

export const CLEARED_ALERT_FEED = { app: null, type: null, q: null } as const;

const TYPE_OPTIONS = ALERT_FEED_EVENTS.map((event) => ({
  value: event,
  label: EVENT_LABELS[event],
}));

const appName = (app: AppListItem): string =>
  `${app.name ?? "Untitled app"} · ${storeLabel(app.store)} · ${app.country.toUpperCase()}`;

function appLabels(
  apps: readonly AppListItem[] | undefined,
  selected: string | null,
): Map<string, string> {
  const labels = new Map(
    (apps ?? []).map((app) => [app.id, appName(app)] as const),
  );
  if (selected !== null && !labels.has(selected))
    labels.set(selected, selected);
  return labels;
}

function chipsOf(
  view: AlertFeedView,
  labels: ReadonlyMap<string, string>,
  setView: SetAlertFeedView,
): FilterChip[] {
  const app = view.app;
  return [
    ...(app === null
      ? []
      : [
          {
            key: "app",
            label: `App: ${labels.get(app) ?? app}`,
            onRemove: () => void setView({ app: null }),
          },
        ]),
    ...view.type.map((event: AlertFeedEvent) => ({
      key: `type-${event}`,
      label: `Event: ${EVENT_LABELS[event]}`,
      onRemove: () =>
        void setView({
          type: view.type.filter((entry) => entry !== event),
        }),
    })),
    ...(view.q === ""
      ? []
      : [
          {
            key: "q",
            label: `Search: ${view.q}`,
            onRemove: () => void setView({ q: null }),
          },
        ]),
  ];
}

export function AlertFeedToolbar({
  shown,
  loaded,
  hasMore,
  searchBox,
  onClearAll,
}: {
  shown: number;
  loaded: number;
  hasMore: boolean;
  searchBox: RefObject<HTMLDivElement | null>;
  onClearAll: () => void;
}) {
  const [view, setView] = useAlertFeedView();
  const hydrated = useHydrated();
  const { data: apps } = useQuery(appsOptions);
  const labels = appLabels(hydrated ? apps : undefined, view.app);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div ref={searchBox} className="w-full sm:w-64">
          <SearchInput
            label="Search alerts"
            value={view.q}
            onSearch={(q, options) =>
              void setView({ q: q === "" ? null : q }, options)
            }
          />
        </div>
        <FacetFilter
          title="App"
          options={[...labels].map(([value, label]) => ({ value, label }))}
          selected={view.app === null ? [] : [view.app]}
          onChange={(selected) =>
            void setView({ app: selected.at(-1) ?? null })
          }
        />
        <FacetFilter
          title="Event type"
          options={TYPE_OPTIONS}
          selected={view.type}
          onChange={(type) => void setView({ type })}
        />
      </div>
      <FilterChips
        chips={chipsOf(view, labels, setView)}
        onClearAll={onClearAll}
      />
      <RowCount shown={shown} total={loaded} noun="event" />
      {hasMore && view.q !== "" ? (
        <p className="text-caption text-muted-foreground">
          {`Searching the ${loaded} loaded events. Load more to search further.`}
        </p>
      ) : null}
    </div>
  );
}
