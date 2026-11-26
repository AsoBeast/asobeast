import Link from "next/link";
import { useTranslations } from "next-intl";
import type { AlertEventItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import { eventLabel } from "@/components/settings/alert-event-copy";
import {
  formatCountryInLocale,
  formatDateTimeInLocale,
  formatUtcClock,
  storeLabel,
} from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { cn } from "@/lib/utils";
import { ALERT_EVENT_ICONS, ALERT_TONE_CLASS } from "./alert-event-icons";
import { alertEventHref } from "./alert-event-href";
import { AlertSizePill } from "./AlertSizePill";
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

function marketNames(
  item: AlertEventItem,
  locale: ReturnType<typeof useAppLocale>,
): { full: string; short: string } {
  const country = item.country;
  return {
    full: [
      item.store ? storeLabel(item.store) : null,
      country ? formatCountryInLocale(country, locale) : null,
    ]
      .filter((part) => part !== null)
      .join(` ${SEPARATOR} `),
    short: country ? country.toUpperCase() : "",
  };
}

function Market({ item }: { item: AlertEventItem }) {
  const locale = useAppLocale();
  const { full, short } = marketNames(item, locale);
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
  const t = useTranslations("notifications");
  const content = (
    <>
      <span className="sr-only">{`${eventLabel(item.event, t)}: `}</span>
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
  const t = useTranslations("alerts");
  const locale = useAppLocale();
  const { icon: Icon, tone } = ALERT_EVENT_ICONS[item.event];
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
            {t("new")}
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
          title={formatDateTimeInLocale(item.occurredAt, locale)}
          className={ALERT_ROW_TIME}
        >
          {formatUtcClock(item.occurredAt)}
        </time>
      </div>
      <AlertSizePill payload={item.payload} className={ALERT_ROW_SIZE} />
    </li>
  );
}
