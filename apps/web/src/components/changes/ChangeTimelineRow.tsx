"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { ChangeEventItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDayMonthInLocale } from "@/lib/format";
import { changeFieldLabel } from "@/lib/change-field-label";
import { localizedLabel } from "@/lib/localizations";
import { useAppLocale } from "@/lib/use-app-locale";
import { dayOf } from "./change-fields";
import type { ChangeEntry } from "./change-runs";
import { ChangeValue } from "./ChangeValue";

const ROW =
  "grid min-h-11 grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b border-border-subtle px-3 py-2 text-dense last:border-b-0 @2xl/timeline:grid-cols-[1.5rem_8.5rem_9.5rem_minmax(0,1fr)_auto] @2xl/timeline:px-4";
const ICON = "self-start @2xl/timeline:mt-0.5";
const NAME =
  "truncate font-medium @2xl/timeline:self-start @2xl/timeline:py-0.5";
const FIELD =
  "col-start-2 row-start-2 text-caption text-muted-foreground @2xl/timeline:col-start-3 @2xl/timeline:row-start-1 @2xl/timeline:self-start @2xl/timeline:py-0.5 @2xl/timeline:text-dense";
const VALUE =
  "col-span-2 col-start-2 row-start-3 min-w-0 @2xl/timeline:col-span-1 @2xl/timeline:col-start-4 @2xl/timeline:row-start-1 @2xl/timeline:self-start @2xl/timeline:py-0.5";
const OWNER = "col-start-3 row-start-1 self-start @2xl/timeline:col-start-5";

function RowFrame({
  event,
  field,
  children,
}: {
  event: ChangeEventItem;
  field: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("changes");
  const name = event.appName ?? t("unknownApp");
  return (
    <li
      data-change-field={event.field}
      aria-label={t("row.aria", { name, field })}
      className={ROW}
    >
      <span className={ICON}>
        <AppIcon src={event.iconUrl ?? null} size={24} />
      </span>
      <bdi className={NAME}>{name}</bdi>
      <span className={FIELD}>{field}</span>
      <div className={VALUE}>{children}</div>
      <Badge variant="flat" className={OWNER}>
        {t(event.isCompetitor ? "competitor" : "yours")}
      </Badge>
    </li>
  );
}

function VersionRun({ events }: { events: ChangeEventItem[] }) {
  const t = useTranslations("changes");
  const locale = useAppLocale();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [newest] = events;

  return (
    <RowFrame event={newest} field={changeFieldLabel("version", t)}>
      <div className="flex flex-col items-start gap-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            <span className="font-medium">
              {t("row.versions", { count: events.length })}
            </span>
            <span className="text-muted-foreground">{t("row.latest")}</span>
            <span className="font-medium">{newest.after ?? "—"}</span>
          </span>
          <Button
            variant="outline"
            size="xs"
            aria-label={t("row.versionsAria", {
              action: t(open ? "row.hideVersions" : "row.showVersions"),
              name: newest.appName ?? t("unknownApp"),
            })}
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((shown) => !shown)}
          >
            {t(open ? "row.hideVersions" : "row.showVersions")}
          </Button>
        </p>
        {open ? (
          <ul id={listId} className="flex flex-col gap-0.5">
            {events.map((event) => (
              <li key={event.id} className="flex gap-3">
                <span className="w-14 shrink-0 text-label text-faint-foreground">
                  {formatDayMonthInLocale(dayOf(event), locale)}
                </span>
                <ChangeValue event={event} dense />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </RowFrame>
  );
}

export function ChangeTimelineRow({ entry }: { entry: ChangeEntry }) {
  const t = useTranslations("changes");
  const locale = useAppLocale();
  if (entry.kind === "versions") return <VersionRun events={entry.events} />;
  const { event } = entry;
  const label = localizedLabel(
    changeFieldLabel(event.field, t),
    event.localization,
    locale,
  );

  return (
    <RowFrame event={event} field={label}>
      <ChangeValue event={event} dense={false} />
    </RowFrame>
  );
}
