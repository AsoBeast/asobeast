import Link from "next/link";
import type { AlertEventItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import { DeltaChip } from "@/components/ui/delta-chip";
import { EVENT_LABELS } from "@/components/settings/alert-event-copy";
import {
  formatCountry,
  formatDateTime,
  formatUtcClock,
  storeLabel,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { ALERT_EVENT_ICONS, ALERT_TONE_CLASS } from "./alert-event-icons";
import { alertEventHref } from "./alert-event-href";
import { alertEventSize } from "./alert-event-size";
import {
  ALERT_ROW,
  ALERT_ROW_APP,
  ALERT_ROW_GLYPH,
  ALERT_ROW_META,
  ALERT_ROW_NEW,
  ALERT_ROW_SENTENCE,
  ALERT_ROW_SIZE,
  ALERT_ROW_TEXT,
  ALERT_ROW_TIME,
} from "./alert-row-classes";

const ROW_LINK =
  "outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset";

const SEPARATOR = "·";

function marketNames(item: AlertEventItem): { full: string; short: string } {
  const country = item.country;
  return {
    full: [
      item.store ? storeLabel(item.store) : null,
      country ? formatCountry(country) : null,
    ]
      .filter((part) => part !== null)
      .join(` ${SEPARATOR} `),
    short: country ? country.toUpperCase() : "",
  };
}

function Market({ item }: { item: AlertEventItem }) {
  const { full, short } = marketNames(item);
  const lead = item.appName === null ? "" : `${SEPARATOR} `;
  return (
    <>
      {full ? (
        <span className="hidden min-w-0 truncate @2xl/alerts:inline">{`${lead}${full}`}</span>
      ) : null}
      {short ? (
        <span className="shrink-0 @2xl/alerts:hidden">{`${lead}${short}`}</span>
      ) : null}
    </>
  );
}

function Sentence({
  item,
  href,
}: {
  item: AlertEventItem;
  href: string | null;
}) {
  const content = (
    <>
      <span className="sr-only">{`${EVENT_LABELS[item.event]}: `}</span>
      <span
        dir="auto"
        className="line-clamp-3 wrap-anywhere @2xl/alerts:line-clamp-2"
      >
        {item.sentence}
      </span>
    </>
  );
  const text = cn(ALERT_ROW_TEXT, "font-medium text-foreground");
  if (href === null) return <p className={text}>{content}</p>;
  return (
    <Link href={href} className={cn(text, ROW_LINK)}>
      {content}
    </Link>
  );
}

export function AlertEventRow({
  item,
  isNew,
}: {
  item: AlertEventItem;
  isNew: boolean;
}) {
  const { icon: Icon, tone } = ALERT_EVENT_ICONS[item.event];
  const size = alertEventSize(item.payload);
  const href = alertEventHref(item);

  return (
    <li
      className={cn(
        ALERT_ROW,
        href !== null &&
          "transition-colors duration-150 ease-out hover:bg-muted motion-reduce:transition-none",
      )}
    >
      <span className={cn(ALERT_ROW_GLYPH, ALERT_TONE_CLASS[tone])}>
        <Icon aria-hidden className="size-4" />
      </span>
      <div className={ALERT_ROW_SENTENCE}>
        <Sentence item={item} href={href} />
        {isNew ? (
          <Badge variant="info" className={ALERT_ROW_NEW}>
            New
          </Badge>
        ) : null}
      </div>
      <div className={ALERT_ROW_META}>
        <span className={ALERT_ROW_APP}>
          {item.appName === null ? null : (
            <>
              <AppIcon src={item.iconUrl} size={16} />
              <bdi className="max-w-3/5 shrink-0 truncate">{item.appName}</bdi>
            </>
          )}
          <Market item={item} />
        </span>
        <time
          dateTime={item.occurredAt}
          title={formatDateTime(item.occurredAt)}
          className={ALERT_ROW_TIME}
        >
          {formatUtcClock(item.occurredAt)}
        </time>
      </div>
      {size ? (
        <DeltaChip
          value={size.value}
          polarity={size.polarity}
          period={size.period}
          form="pill"
          className={ALERT_ROW_SIZE}
        />
      ) : null}
    </li>
  );
}
