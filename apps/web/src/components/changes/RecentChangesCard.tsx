"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { CHANGE_FIELD_LABELS } from "@asobeast/shared";
import type { ChangeEventItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FEED_LINK,
  FEED_ROW,
  FEED_TEXT,
  FeedDay,
  feedDayLabel,
} from "@/components/dashboard/feed-row";
import { FeedCardSkeleton } from "@/components/dashboard/skeletons";
import { PANEL_ACTION, PANEL_HEADER } from "@/components/layout/panel-classes";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { focusIsLost } from "@/lib/focus-handoff";
import { formatDayMonth } from "@/lib/format";
import { localizedLabel } from "@/lib/localizations";
import { portfolioOptions, recentChangesOptions } from "@/lib/queries";
import { changeOwnerParser, type ChangeOwner } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { collapseVersions, entryEvent, type ChangeEntry } from "./change-runs";
import { ChangeValue } from "./ChangeTimeline";

const VISIBLE_CHANGES = 8;

const OWNER_TABS: Array<{ value: ChangeOwner; label: string }> = [
  { value: "all", label: "All" },
  { value: "yours", label: "Yours" },
  { value: "competitors", label: "Competitors" },
];

const EMPTY_FILTER: Record<ChangeOwner, string> = {
  all: "No changes in this window.",
  yours: "No changes to your apps in this window.",
  competitors: "No changes from competitors in this window.",
};

const ownedBy =
  (owner: ChangeOwner) =>
  (event: ChangeEventItem): boolean =>
    owner === "all" || event.isCompetitor === (owner === "competitors");

const dayOf = (event: ChangeEventItem): string => event.capturedAt.slice(0, 10);

function entryDay(entry: ChangeEntry, today: string): string {
  if (entry.kind === "event") return feedDayLabel(dayOf(entry.event), today);
  const first = formatDayMonth(dayOf(entry.events[entry.events.length - 1]));
  const last = formatDayMonth(dayOf(entry.events[0]));
  return first === last ? last : `${first} to ${last}`;
}

function VersionRun({ events }: { events: ChangeEventItem[] }) {
  const newest = events[0];
  return (
    <>
      <bdi>{newest.appName ?? "Unknown app"}</bdi>
      <span className="text-muted-foreground">{" shipped "}</span>
      <span className="font-medium">{`${events.length} versions`}</span>
      <span className="text-muted-foreground">{" · latest "}</span>
      <span className="font-medium">{newest.after ?? "—"}</span>
    </>
  );
}

function EventLine({ event }: { event: ChangeEventItem }) {
  const label = localizedLabel(
    CHANGE_FIELD_LABELS[event.field],
    event.localization,
  );
  const field = event.country
    ? `${label} · ${event.country.toUpperCase()}`
    : label;
  const name = event.appName ?? "Unknown app";
  return (
    <>
      <span className="text-muted-foreground">{`${field} · `}</span>
      {event.isCompetitor ? (
        <>
          <bdi className="text-muted-foreground">{name}</bdi>
          <span className="text-muted-foreground">{" · "}</span>
        </>
      ) : (
        <span className="sr-only">{`${name}: `}</span>
      )}
      <ChangeValue event={event} dense />
    </>
  );
}

function EntryRow({
  entry,
  iconUrl,
  today,
}: {
  entry: ChangeEntry;
  iconUrl: string | null;
  today: string;
}) {
  const event = entryEvent(entry);
  return (
    <Link
      href={`/apps/${event.appId}/changes`}
      data-change-field={event.field}
      className={cn(FEED_ROW, FEED_LINK)}
    >
      <FeedDay>{entryDay(entry, today)}</FeedDay>
      <span className="flex min-w-0 items-center gap-2">
        <AppIcon src={iconUrl} size={16} />
        <span className={cn(FEED_TEXT, "wrap-anywhere")}>
          {entry.kind === "versions" ? (
            <VersionRun events={entry.events} />
          ) : (
            <EventLine event={event} />
          )}
        </span>
      </span>
      <Badge variant="flat">
        {event.isCompetitor ? "competitor" : "yours"}
      </Badge>
    </Link>
  );
}

function RecentChanges({ today }: { today: string }) {
  const { data } = useSuspenseQuery(recentChangesOptions());
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const [owner, setOwner] = useQueryState("changes", changeOwnerParser);
  const [expanded, setExpanded] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const revealing = useRef(false);

  useEffect(() => {
    if (!revealing.current) return;
    revealing.current = false;
    if (!focusIsLost()) return;
    list.current
      ?.querySelectorAll<HTMLElement>("a[href]")
      .item(VISIBLE_CHANGES)
      ?.focus();
  }, [expanded]);

  const mixed =
    data.events.some((event) => event.isCompetitor) &&
    data.events.some((event) => !event.isCompetitor);
  const active = mixed ? owner : "all";
  const entries = collapseVersions(data.events.filter(ownedBy(active)));
  const shown = expanded ? entries : entries.slice(0, VISIBLE_CHANGES);
  const hidden = entries.length - shown.length;
  const icons = new Map(portfolio.apps.map((app) => [app.id, app.iconUrl]));

  return (
    <Card className="h-full">
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>Listing changes</h2>
        </CardTitle>
        {mixed ? (
          <CardAction className={PANEL_ACTION}>
            <Tabs
              value={owner}
              onValueChange={(value) =>
                void setOwner(changeOwnerParser.parse(value))
              }
            >
              <TabsList aria-label="Changes shown">
                {OWNER_TABS.map((tab) => (
                  <TabsOption key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsOption>
                ))}
              </TabsList>
            </Tabs>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="px-2">
        <div ref={list} className="flex flex-col gap-2">
          {entries.length === 0 ? (
            <p className="px-2 text-body text-muted-foreground">
              {data.events.length === 0
                ? "Listing changes appear here after the daily refreshes."
                : EMPTY_FILTER[active]}
            </p>
          ) : (
            <ul className="flex flex-col">
              {shown.map((entry) => {
                const event = entryEvent(entry);
                return (
                  <li key={event.id}>
                    <EntryRow
                      entry={entry}
                      today={today}
                      iconUrl={event.iconUrl ?? icons.get(event.appId) ?? null}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {hidden > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => {
                revealing.current = true;
                setExpanded(true);
              }}
            >
              {`Show ${hidden} more`}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function RecentChangesCard({ today }: { today: string }) {
  return (
    <Suspense fallback={<FeedCardSkeleton />}>
      <RecentChanges today={today} />
    </Suspense>
  );
}
