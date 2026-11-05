import Link from "next/link";
import type { AlertEventItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import { EVENT_LABELS } from "@/components/settings/alert-event-copy";
import {
  formatCountry,
  formatDateTime,
  formatRelativeTime,
  storeLabel,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { ALERT_EVENT_ICONS, ALERT_TONE_CLASS } from "./alert-event-icons";
import { alertEventHref } from "./alert-event-href";

function metaOf(item: AlertEventItem): string {
  return [
    item.store ? storeLabel(item.store) : null,
    item.country ? formatCountry(item.country) : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

function Sentence({ item }: { item: AlertEventItem }) {
  const href = alertEventHref(item);
  const content = (
    <>
      <span className="sr-only">{`${EVENT_LABELS[item.event]}: `}</span>
      <span dir="auto" className="block wrap-anywhere">
        {item.sentence}
      </span>
    </>
  );
  if (href === null) {
    return <p className="text-body text-foreground">{content}</p>;
  }
  return (
    <Link
      href={href}
      className="rounded-sm text-body font-medium text-foreground underline-offset-4 decoration-primary hover:underline"
    >
      {content}
    </Link>
  );
}

export function AlertEventRow({
  item,
  now,
  isNew,
}: {
  item: AlertEventItem;
  now: number;
  isNew: boolean;
}) {
  const { icon: Icon, tone } = ALERT_EVENT_ICONS[item.event];
  const meta = metaOf(item);

  return (
    <li className="flex min-w-0 items-start gap-3 rounded-lg border bg-card px-3 py-3">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md bg-muted",
          ALERT_TONE_CLASS[tone],
        )}
      >
        <Icon aria-hidden className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Sentence item={item} />
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
          {item.appName === null ? null : (
            <span className="flex min-w-0 items-center gap-1.5">
              <AppIcon src={item.iconUrl} name={item.appName} size={20} />
              <bdi className="wrap-anywhere">{item.appName}</bdi>
            </span>
          )}
          {meta ? <span>{meta}</span> : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {isNew ? <Badge variant="info">New</Badge> : null}
        <time
          dateTime={item.occurredAt}
          title={formatDateTime(item.occurredAt)}
          className="text-caption text-muted-foreground"
        >
          {formatRelativeTime(item.occurredAt, now)}
        </time>
      </div>
    </li>
  );
}
