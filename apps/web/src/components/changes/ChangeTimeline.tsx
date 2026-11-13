"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { ChangeEventItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { MarketSwitcher } from "@/components/app-detail/MarketSwitcher";
import { useMarket } from "@/components/app-detail/use-market";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { CHANGE_FIELD_LABELS } from "@asobeast/shared";
import { localizedLabel } from "@/lib/localizations";
import { changeImpactOptions, changesOptions } from "@/lib/queries";
import { formatCountry, formatDate } from "@/lib/format";
import { queryMarket } from "@/lib/market";
import { CHANGE_WINDOWS } from "@/lib/ranges";
import { changeDaysParser, countryParser } from "@/lib/search-params";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { conversionChip, funnelByDay } from "./change-funnel";
import { ChangeValue } from "./ChangeValue";
import { ChangeTimelineSkeleton } from "./skeletons";

function dayKey(capturedAt: string): string {
  return capturedAt.slice(0, 10);
}

function ChangeRow({
  event,
  dense,
}: {
  event: ChangeEventItem;
  dense: boolean;
}) {
  return (
    <div
      data-change-field={event.field}
      className={cn(
        "flex items-start gap-3 py-3",
        dense ? null : "border-l-2 pl-4",
        dense
          ? null
          : event.isCompetitor
            ? "border-muted-foreground/40"
            : "border-primary",
      )}
    >
      <AppIcon src={event.iconUrl ?? null} size={32} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body font-medium">
            {event.appName ?? "Unknown app"}
          </span>
          <Badge variant={event.isCompetitor ? "secondary" : "outline"}>
            {event.isCompetitor ? "Competitor" : "Your app"}
          </Badge>
          <Badge variant="outline">
            {localizedLabel(
              CHANGE_FIELD_LABELS[event.field],
              event.localization,
            )}
          </Badge>
        </div>
        <div className="text-body">
          <ChangeValue event={event} dense={dense} />
        </div>
      </div>
    </div>
  );
}

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

function DayConversion({
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
  const [impactCountry] = useQueryState("country", countryParser);
  const { data: impact } = useSuspenseQuery(
    changeImpactOptions(id, days, impactCountry || homeCountry),
  );
  const chip = conversionChip(funnelByDay(impact).get(day));
  return chip === null ? null : <ConversionChip value={chip} />;
}

function ChangeList({
  id,
  days,
  market,
  homeCountry,
}: {
  id: string;
  days: number;
  market?: string;
  homeCountry: string;
}) {
  const { data } = useSuspenseQuery(changesOptions(id, days, market));

  if (data.events.length === 0) {
    return (
      <EmptyState
        title={`No changes in the last ${days} days`}
        body="Metadata changes appear after a daily refresh finds one. Widen the window to look further back."
      />
    );
  }

  const groups = new Map<string, ChangeEventItem[]>();
  for (const event of data.events) {
    const key = dayKey(event.capturedAt);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(event);
    } else {
      groups.set(key, [event]);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {Array.from(groups.entries()).map(([day, events]) => (
        <section key={day} className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-label text-muted-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-border" />
            {formatDate(day)}
            {market === undefined ? (
              <Suspense fallback={null}>
                <DayConversion
                  id={id}
                  days={days}
                  day={day}
                  homeCountry={homeCountry}
                />
              </Suspense>
            ) : null}
            <span aria-hidden className="h-px flex-1 bg-border" />
          </h2>
          <div className="flex flex-col gap-2">
            {events.map((event) => (
              <ChangeRow key={event.id} event={event} dense={false} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MarketHeading({ id }: { id: string }) {
  const { market, home } = useMarket(id);
  return market === home ? "Changes" : `Changes · ${formatCountry(market)}`;
}

function MarketChangeList({ id, days }: { id: string; days: number }) {
  const { market, home } = useMarket(id);
  return (
    <ChangeList
      id={id}
      days={days}
      market={queryMarket(market, home)}
      homeCountry={home}
    />
  );
}

export function ChangeTimeline({ id }: { id: string }) {
  const [days, setDays] = useQueryState("days", changeDaysParser);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardDescription>
            <Suspense fallback="Changes">
              <MarketHeading id={id} />
            </Suspense>
          </CardDescription>
          <CardTitle>Metadata change timeline</CardTitle>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Suspense fallback={null}>
            <MarketSwitcher id={id} />
          </Suspense>
          <Tabs
            value={String(days)}
            onValueChange={(next) => void setDays(Number(next) as typeof days)}
          >
            <TabsList>
              {CHANGE_WINDOWS.map((window) => (
                <TabsOption key={window} value={String(window)}>
                  {window}d
                </TabsOption>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<ChangeTimelineSkeleton />}>
          <MarketChangeList id={id} days={days} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
