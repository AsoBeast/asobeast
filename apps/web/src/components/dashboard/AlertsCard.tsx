"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { AlertEventItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { alertEventHref } from "@/components/alerts/alert-event-href";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { EVENT_LABELS } from "@/components/settings/alert-event-copy";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { alertRecentOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { ALERT_KINDS } from "./alert-kind";
import { FEED_LINK, FEED_ROW, FeedDay, feedDayLabel } from "./feed-row";
import { FeedRowsSkeleton } from "./skeletons";
import { PANEL_ACTION, PANEL_HEADER } from "./layout-classes";
import { dayBefore } from "@/lib/utc-day";

const WINDOW_DAYS = 7;
const DAYS_BEFORE_TODAY = WINDOW_DAYS - 1;

function AlertLine({ item, today }: { item: AlertEventItem; today: string }) {
  const href = alertEventHref(item);
  const kind = ALERT_KINDS[item.event];
  const body = (
    <>
      <FeedDay>{feedDayLabel(item.occurredAt.slice(0, 10), today)}</FeedDay>
      <span className="flex min-w-0 items-center gap-2">
        <AppIcon src={item.iconUrl} size={16} />
        <span className="line-clamp-2 min-w-0">
          <span className="sr-only">{`${EVENT_LABELS[item.event]}: `}</span>
          <span dir="auto" className="wrap-anywhere">
            {item.sentence}
          </span>
        </span>
      </span>
      <Badge variant={kind.tone}>{kind.word}</Badge>
    </>
  );
  return href === null ? (
    <div className={FEED_ROW}>{body}</div>
  ) : (
    <Link href={href} className={cn(FEED_ROW, FEED_LINK)}>
      {body}
    </Link>
  );
}

function AlertList({ today }: { today: string }) {
  const read = useQuery(
    alertRecentOptions(dayBefore(today, DAYS_BEFORE_TODAY)),
  );

  if (failedRead(read)) {
    return (
      <div className="px-2">
        <InlineQueryError message="Alerts could not be loaded." read={read} />
      </div>
    );
  }
  if (read.data === undefined) {
    return (
      <div role="status">
        <span className="sr-only">Loading alerts</span>
        <FeedRowsSkeleton />
      </div>
    );
  }
  if (read.data.events.length === 0) {
    return (
      <p className="px-2 text-body text-muted-foreground">
        No alerts in the last 7 days.
      </p>
    );
  }
  return (
    <ul className="flex flex-col">
      {read.data.events.map((item) => (
        <li key={item.id}>
          <AlertLine item={item} today={today} />
        </li>
      ))}
    </ul>
  );
}

export function AlertsCard({ today }: { today: string }) {
  return (
    <Card className="h-full">
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>Alerts</h2>
        </CardTitle>
        <CardAction
          className={cn(PANEL_ACTION, "text-label text-faint-foreground")}
        >
          Last 7 days
        </CardAction>
      </CardHeader>
      <CardContent className="px-2">
        <AlertList today={today} />
      </CardContent>
    </Card>
  );
}
