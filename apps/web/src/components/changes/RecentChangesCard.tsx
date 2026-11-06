"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { CHANGE_FIELD_LABELS } from "@asobeast/shared";
import type { ChangeEventItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { formatDayMonth } from "@/lib/format";
import { localizedLabel } from "@/lib/localizations";
import { portfolioOptions, recentChangesOptions } from "@/lib/queries";
import { changeOwnerParser, type ChangeOwner } from "@/lib/search-params";
import { groupChangesByDay } from "./change-days";
import { collapseVersions, entryEvent, type ChangeEntry } from "./change-runs";
import { ChangeValue } from "./ChangeTimeline";
import { ChangeTimelineSkeleton } from "./skeletons";

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

function VersionRun({ events }: { events: ChangeEventItem[] }) {
  const newest = events[0];
  const oldest = events[events.length - 1];
  return (
    <span className="text-muted-foreground">
      {`${events.length} version updates, ${formatDayMonth(oldest.capturedAt.slice(0, 10))} to ${formatDayMonth(newest.capturedAt.slice(0, 10))} · latest `}
      <span className="font-medium text-foreground">{newest.after ?? "—"}</span>
    </span>
  );
}

function EntryRow({
  entry,
  iconUrl,
}: {
  entry: ChangeEntry;
  iconUrl: string | null;
}) {
  const event = entryEvent(entry);
  const field =
    entry.kind === "versions"
      ? "Versions"
      : localizedLabel(CHANGE_FIELD_LABELS[event.field], event.localization);
  return (
    <Link
      href={`/apps/${event.appId}/changes`}
      data-change-field={event.field}
      className="flex min-h-10 items-start gap-3 rounded-md px-2 py-2 outline-none transition-colors duration-150 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="pt-0.5">
        <AppIcon src={iconUrl} size={16} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-dense">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <bdi className="font-medium wrap-anywhere">
            {event.appName ?? "Unknown app"}
          </bdi>
          <span className="text-label text-faint-foreground">{field}</span>
        </span>
        <span className="wrap-anywhere">
          {entry.kind === "versions" ? (
            <VersionRun events={entry.events} />
          ) : (
            <ChangeValue event={event} dense />
          )}
        </span>
      </span>
      <Badge variant="flat" className="mt-0.5">
        {event.isCompetitor ? "competitor" : "yours"}
      </Badge>
    </Link>
  );
}

function RecentChangesList({ today }: { today: string }) {
  const { data } = useSuspenseQuery(recentChangesOptions());
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const [owner, setOwner] = useQueryState("changes", changeOwnerParser);
  const [expanded, setExpanded] = useState(false);

  if (data.events.length === 0) {
    return (
      <p className="px-2 text-body text-muted-foreground">
        Listing changes appear here after the daily refreshes.
      </p>
    );
  }

  const mixed =
    data.events.some((event) => event.isCompetitor) &&
    data.events.some((event) => !event.isCompetitor);
  const active = mixed ? owner : "all";
  const entries = collapseVersions(data.events.filter(ownedBy(active)));
  const shown = expanded ? entries : entries.slice(0, VISIBLE_CHANGES);
  const hidden = entries.length - shown.length;
  const icons = new Map(portfolio.apps.map((app) => [app.id, app.iconUrl]));
  const byEvent = new Map(shown.map((entry) => [entryEvent(entry).id, entry]));

  return (
    <div className="flex flex-col gap-3">
      {mixed ? (
        <Tabs
          value={owner}
          onValueChange={(value) =>
            void setOwner(changeOwnerParser.parse(value))
          }
          className="px-2"
        >
          <TabsList aria-label="Changes shown">
            {OWNER_TABS.map((tab) => (
              <TabsOption key={tab.value} value={tab.value}>
                {tab.label}
              </TabsOption>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      {entries.length === 0 ? (
        <p className="px-2 text-body text-muted-foreground">
          {EMPTY_FILTER[active]}
        </p>
      ) : (
        groupChangesByDay(shown.map(entryEvent), today).map((group) => (
          <section key={group.day} className="flex flex-col">
            <h3 className="px-2 pb-1 text-label text-faint-foreground">
              {group.label}
            </h3>
            <ul className="flex flex-col">
              {group.events.map((event) => {
                const entry = byEvent.get(event.id);
                return entry ? (
                  <li key={event.id}>
                    <EntryRow
                      entry={entry}
                      iconUrl={
                        event.isCompetitor
                          ? null
                          : (icons.get(event.appId) ?? null)
                      }
                    />
                  </li>
                ) : null;
              })}
            </ul>
          </section>
        ))
      )}

      {hidden > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setExpanded(true)}
        >
          {`Show ${hidden} more`}
        </Button>
      ) : null}
    </div>
  );
}

export function RecentChangesCard({ today }: { today: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>Listing changes</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2">
        <Suspense fallback={<ChangeTimelineSkeleton />}>
          <RecentChangesList today={today} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
