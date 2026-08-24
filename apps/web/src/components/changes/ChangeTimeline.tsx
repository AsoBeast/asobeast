"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { ChangeEventItem, ChangeField } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { changesOptions } from "@/lib/queries";
import { formatDate, formatNumber, formatPrice } from "@/lib/format";
import { CHANGE_WINDOWS } from "@/lib/ranges";
import { changeDaysParser } from "@/lib/search-params";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { ChangeTimelineSkeleton } from "./skeletons";

const FIELD_LABELS: Record<ChangeField, string> = {
  title: "Title",
  subtitle: "Subtitle",
  summary: "Summary",
  description: "Description",
  version: "Version",
  price: "Price",
  screenshots: "Screenshots",
  icon: "Icon",
  whatsNew: "What's New",
};

function dayKey(capturedAt: string): string {
  return capturedAt.slice(0, 10);
}

function text(value: string | null): string {
  return value === null || value === "" ? "—" : value;
}

function chars(value: string | null): string {
  return value === null ? "—" : `${formatNumber(Number(value))} chars`;
}

function price(value: string | null): string {
  return value === null ? "—" : formatPrice(Number(value));
}

function count(value: string | null): string {
  return value === null ? "—" : formatNumber(Number(value));
}

function ChangeValue({
  event,
  dense,
}: {
  event: ChangeEventItem;
  dense: boolean;
}) {
  const { field, before, after } = event;

  if (field === "icon") {
    return <span className="text-muted-foreground">Icon updated</span>;
  }

  if (field === "whatsNew") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="break-words">
            <span className="text-muted-foreground">What’s New updated: </span>
            <span className={cn("font-medium", dense ? null : "block")}>
              {text(after)}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          Previous: {text(before)}
        </TooltipContent>
      </Tooltip>
    );
  }

  let from: string;
  let to: string;
  if (field === "summary" || field === "description") {
    from = chars(before);
    to = chars(after);
  } else if (field === "price") {
    from = price(before);
    to = price(after);
  } else if (field === "screenshots") {
    from = count(before);
    to = count(after);
  } else {
    from = text(before);
    to = text(after);
  }

  if (dense) {
    return (
      <span className="break-words">
        <span className="text-muted-foreground line-through">{from}</span>
        <span className="mx-1.5 text-muted-foreground">→</span>
        <span className="font-medium">{to}</span>
      </span>
    );
  }

  return (
    <span className="grid gap-1 sm:grid-cols-2">
      <span className="flex flex-col gap-0.5 rounded-md bg-muted/50 px-2 py-1">
        <span className="text-label text-muted-foreground uppercase">
          Before
        </span>
        <span className="break-words text-muted-foreground">{from}</span>
      </span>
      <span className="flex flex-col gap-0.5 rounded-md bg-success-subtle px-2 py-1">
        <span className="text-label text-muted-foreground uppercase">
          After
        </span>
        <span className="break-words font-medium">{to}</span>
      </span>
    </span>
  );
}

export function ChangeRow({
  event,
  dense = true,
}: {
  event: ChangeEventItem;
  dense?: boolean;
}) {
  return (
    <div
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
      <AppIcon src={null} name={event.appName} size={32} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body font-medium">
            {event.appName ?? "Unknown app"}
          </span>
          <Badge variant={event.isCompetitor ? "secondary" : "outline"}>
            {event.isCompetitor ? "Competitor" : "Your app"}
          </Badge>
          <Badge variant="outline">{FIELD_LABELS[event.field]}</Badge>
        </div>
        <div className="text-body">
          <ChangeValue event={event} dense={dense} />
        </div>
      </div>
    </div>
  );
}

function ChangeList({ id, days }: { id: string; days: number }) {
  const { data } = useSuspenseQuery(changesOptions(id, days));

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
          <h2 className="flex items-center gap-2 text-label text-muted-foreground uppercase">
            <span aria-hidden className="size-1.5 rounded-full bg-border" />
            {formatDate(day)}
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

export function ChangeTimeline({ id }: { id: string }) {
  const [days, setDays] = useQueryState("days", changeDaysParser);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardDescription>Changes</CardDescription>
          <CardTitle>Metadata change timeline</CardTitle>
        </div>
        <Tabs
          value={String(days)}
          onValueChange={(next) => void setDays(Number(next) as typeof days)}
        >
          <TabsList>
            {CHANGE_WINDOWS.map((window) => (
              <TabsTrigger key={window} value={String(window)}>
                {window}d
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<ChangeTimelineSkeleton />}>
          <ChangeList id={id} days={days} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
