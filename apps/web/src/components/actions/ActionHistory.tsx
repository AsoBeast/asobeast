import type { ActionEventItem } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { formatDateTimeInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { historyEntries } from "./action-history";

export function ActionHistory({ events }: { events: ActionEventItem[] }) {
  const t = useTranslations("actions");
  const locale = useAppLocale();
  if (events.length === 0) {
    return (
      <p className="text-body text-muted-foreground">{t("historyEmpty")}</p>
    );
  }

  return (
    <ol className="flex list-none flex-col gap-3 p-0">
      {historyEntries(events, t, locale).map((entry) => (
        <li key={entry.id} className="flex flex-col gap-0.5">
          <span className="text-body font-medium">
            {entry.label}
            {entry.detail ? (
              <span className="font-normal text-muted-foreground">
                {" "}
                · {entry.detail}
              </span>
            ) : null}
          </span>
          <span className="text-caption text-muted-foreground">
            <time dateTime={entry.date}>
              {formatDateTimeInLocale(entry.date, locale)}
            </time>{" "}
            · {entry.actor}
          </span>
        </li>
      ))}
    </ol>
  );
}
