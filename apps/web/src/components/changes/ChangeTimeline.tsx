"use client";

import { Suspense, useEffect, useId, useRef } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { ChangeEventItem } from "@asobeast/shared";
import { useMarket } from "@/components/app-detail/use-market";
import { PANEL_BLEED, PANEL_HEADER } from "@/components/layout/panel-classes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeltaChip } from "@/components/ui/delta-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import {
  formatCountry,
  formatDate,
  formatDayMonth,
  pluralize,
} from "@/lib/format";
import { changeImpactOptions } from "@/lib/queries";
import { CHANGE_WINDOWS, type ChangeWindow } from "@/lib/ranges";
import {
  changeDaysParser,
  changeOwnerParser,
  type ChangeFieldGroup,
  type ChangeOwner,
} from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { changeEffect, impactAnchor, timelineAnchor } from "./change-effects";
import {
  dayOf,
  fieldGroupLabel,
  matchesFilter,
  ownerCounts,
} from "./change-fields";
import { conversionChip, funnelByDay } from "./change-funnel";
import { collapseVersions, entryEvent, type ChangeEntry } from "./change-runs";
import { ChangeTimelineRow } from "./ChangeTimelineRow";
import { ChangesCardSkeleton } from "./skeletons";
import {
  useChangeEvents,
  useChangeFilter,
  useImpactCountry,
} from "./use-change-view";

const WIDEST_WINDOW: ChangeWindow = CHANGE_WINDOWS[CHANGE_WINDOWS.length - 1];

const OWNER_TABS: ReadonlyArray<{ value: ChangeOwner; label: string }> = [
  { value: "all", label: "All" },
  { value: "yours", label: "Yours" },
  { value: "competitors", label: "Competitors" },
];

const DAY_HEADING =
  "flex min-h-9 scroll-mt-16 flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-border-subtle px-3 py-1.5 text-label text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset @2xl/timeline:px-4";

function ConversionChip({ value }: { value: number }) {
  const tone =
    value > 0
      ? "text-signal-up"
      : value < 0
        ? "text-signal-down"
        : "text-muted-foreground";
  return (
    <span className={cn("numeric", tone)}>
      {`Conversion ${value > 0 ? "+" : ""}${value}%`}
    </span>
  );
}

function DayEffects({
  id,
  days,
  day,
  homeCountry,
}: {
  id: string;
  days: number;
  day: string;
  homeCountry: string;
}) {
  const country = useImpactCountry(homeCountry);
  const { data: impact } = useSuspenseQuery(
    changeImpactOptions(id, days, country),
  );
  const item = impact.items.find((entry) => entry.changedOn === day);
  const effect = item ? changeEffect(item) : null;
  const conversion = conversionChip(funnelByDay(impact).get(day));
  if (effect === null && conversion === null) return null;

  return (
    <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-0.5 font-normal text-muted-foreground">
      {effect?.kind === "measured" ? (
        <a
          href={`#${impactAnchor(day)}`}
          className="inline-flex items-center gap-1 rounded-sm text-foreground link-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>Visibility</span>
          <DeltaChip
            value={effect.change}
            polarity="higher-is-better"
            period="in visibility"
          />
          <span>{`after ${effect.days} days`}</span>
        </a>
      ) : null}
      {effect?.kind === "pending" ? (
        <span>{`Measurable on ${formatDayMonth(effect.measurableOn)}`}</span>
      ) : null}
      {conversion === null ? null : <ConversionChip value={conversion} />}
    </span>
  );
}

function dayGroups(entries: ChangeEntry[]): Array<[string, ChangeEntry[]]> {
  const groups = new Map<string, ChangeEntry[]>();
  for (const entry of entries) {
    const day = dayOf(entryEvent(entry));
    groups.set(day, [...(groups.get(day) ?? []), entry]);
  }
  return [...groups.entries()];
}

const changesOn = (entries: ChangeEntry[], day: string): number =>
  entries
    .flatMap((entry) =>
      entry.kind === "versions" ? entry.events : entry.event,
    )
    .filter((event) => dayOf(event) === day).length;

function footerLine({
  readOn,
  listing,
  days,
  field,
  shown,
  total,
}: {
  readOn: string | null | undefined;
  listing: string;
  days: number;
  field: ChangeFieldGroup | null;
  shown: number | null;
  total: number;
}): string {
  return [
    readOn ? `Listing read ${formatDayMonth(readOn.slice(0, 10))}` : null,
    listing.toUpperCase(),
    `${days} days`,
    field ? `${fieldGroupLabel(field)} only` : null,
    shown === null
      ? pluralize(total, "change")
      : `${pluralize(shown, "change")} of ${total}`,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

function TimelineEmpty({
  days,
  onWiden,
  onClear,
}: {
  days: number | null;
  onWiden: () => void;
  onClear: () => void;
}) {
  if (days === null) {
    return (
      <EmptyState
        className="px-4 py-12"
        title="No changes match this filter"
        action={
          <Button variant="outline" onClick={onClear}>
            Clear filter
          </Button>
        }
      />
    );
  }
  return (
    <EmptyState
      className="px-4 py-12"
      title={`No changes in the last ${days} days`}
      body="Listing changes appear after a daily refresh finds one."
      action={
        days === WIDEST_WINDOW ? null : (
          <Button variant="outline" onClick={onWiden}>
            {`Show ${WIDEST_WINDOW} days`}
          </Button>
        )
      }
    />
  );
}

function TimelineDays({
  id,
  days,
  homeCountry,
  groups,
}: {
  id: string;
  days: number;
  homeCountry: string | null;
  groups: Array<[string, ChangeEntry[]]>;
}) {
  return groups.map(([day, entries]) => (
    <section key={day} className="border-t border-border first:border-t-0">
      <h2 id={timelineAnchor(day)} tabIndex={-1} className={DAY_HEADING}>
        <span>
          <span>{formatDate(day)}</span>
          <span className="font-normal text-faint-foreground">{` · ${pluralize(changesOn(entries, day), "change")}`}</span>
        </span>
        {homeCountry === null ? null : (
          <Suspense fallback={null}>
            <DayEffects
              id={id}
              days={days}
              day={day}
              homeCountry={homeCountry}
            />
          </Suspense>
        )}
      </h2>
      <ul>
        {entries.map((entry) => (
          <ChangeTimelineRow key={entryEvent(entry).id} entry={entry} />
        ))}
      </ul>
    </section>
  ));
}

function Timeline({
  id,
  focusDay,
  onFocused,
}: {
  id: string;
  focusDay: string | null;
  onFocused: () => void;
}) {
  const headingId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const { events, days, listing, homeListing } = useChangeEvents(id);
  const { home, markets } = useMarket(id);
  const [, setDays] = useQueryState("days", changeDaysParser);
  const { filter, setFilter, clearFilter } = useChangeFilter();

  useEffect(() => {
    if (focusDay === null) return;
    const heading = document.getElementById(timelineAnchor(focusDay));
    heading?.scrollIntoView({ block: "start" });
    heading?.focus({ preventScroll: true });
    onFocused();
  }, [focusDay, onFocused]);

  const counted = events.filter((event) =>
    matchesFilter(event, { owner: "all", field: filter.field }),
  );
  const counts = ownerCounts(counted);
  const mixed = events.some(isCompetitor) && events.some(isOwn);
  const owner = mixed ? filter.owner : "all";
  const shown = events.filter((event) =>
    matchesFilter(event, { owner, field: filter.field }),
  );
  const readOn = markets.find((entry) => entry.country === listing)?.capturedAt;
  const filtered = owner !== "all" || filter.field !== null;

  const act = (run: () => void) => () => {
    run();
    panel.current?.focus();
  };

  return (
    <section aria-labelledby={headingId}>
      <Card ref={panel} tabIndex={-1} className="outline-none">
        <CardHeader
          className={cn(
            PANEL_HEADER,
            "max-sm:has-data-[slot=card-action]:grid-cols-1",
          )}
        >
          <CardTitle asChild>
            <h2 id={headingId}>
              {homeListing
                ? "Listing changes"
                : `Listing changes · ${formatCountry(listing)}`}
            </h2>
          </CardTitle>
          {mixed ? (
            <CardAction className="max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-2 max-sm:justify-self-start">
              <Tabs
                value={owner}
                onValueChange={(value) =>
                  setFilter({ owner: changeOwnerParser.parse(value) ?? "all" })
                }
              >
                <TabsList aria-label="Changes shown">
                  {OWNER_TABS.map((tab) => (
                    <TabsOption key={tab.value} value={tab.value}>
                      <span>{tab.label}</span>
                      <span className="numeric font-normal text-muted-foreground">
                        {counts[tab.value]}
                      </span>
                    </TabsOption>
                  ))}
                </TabsList>
              </Tabs>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className={cn(PANEL_BLEED, "@container/timeline")}>
          {shown.length === 0 ? (
            <TimelineEmpty
              days={events.length === 0 ? days : null}
              onWiden={act(() => void setDays(WIDEST_WINDOW))}
              onClear={act(clearFilter)}
            />
          ) : null}
          <TimelineDays
            id={id}
            days={days}
            homeCountry={homeListing ? home : null}
            groups={dayGroups(collapseVersions(shown))}
          />
        </CardContent>
        {events.length > 0 ? (
          <CardFooter className="flex-wrap justify-between gap-x-4 gap-y-2">
            <span>
              {footerLine({
                readOn,
                listing,
                days,
                field: filter.field,
                shown: filtered ? shown.length : null,
                total: events.length,
              })}
            </span>
            {filtered && shown.length > 0 ? (
              <Button variant="outline" size="sm" onClick={act(clearFilter)}>
                Clear filter
              </Button>
            ) : null}
          </CardFooter>
        ) : null}
      </Card>
    </section>
  );
}

const isCompetitor = (event: ChangeEventItem): boolean => event.isCompetitor;
const isOwn = (event: ChangeEventItem): boolean => !event.isCompetitor;

export function ChangeTimeline(props: {
  id: string;
  focusDay: string | null;
  onFocused: () => void;
}) {
  return (
    <Suspense fallback={<ChangesCardSkeleton />}>
      <Timeline {...props} />
    </Suspense>
  );
}
