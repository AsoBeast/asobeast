"use client";

import { useId, useState } from "react";
import { CHANGE_FIELD_LABELS } from "@asobeast/shared";
import type { ChangeEventItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDayMonth } from "@/lib/format";
import { localizedLabel } from "@/lib/localizations";
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
  return (
    <li
      data-change-field={event.field}
      aria-label={`${event.appName ?? "Unknown app"}, ${field}`}
      className={ROW}
    >
      <span className={ICON}>
        <AppIcon src={event.iconUrl ?? null} size={24} />
      </span>
      <bdi className={NAME}>{event.appName ?? "Unknown app"}</bdi>
      <span className={FIELD}>{field}</span>
      <div className={VALUE}>{children}</div>
      <Badge variant="flat" className={OWNER}>
        {event.isCompetitor ? "competitor" : "yours"}
      </Badge>
    </li>
  );
}

function VersionRun({ events }: { events: ChangeEventItem[] }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [newest] = events;

  return (
    <RowFrame event={newest} field={CHANGE_FIELD_LABELS.version}>
      <div className="flex flex-col items-start gap-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            <span className="font-medium">{`${events.length} versions`}</span>
            <span className="text-muted-foreground">{" · latest "}</span>
            <span className="font-medium">{newest.after ?? "—"}</span>
          </span>
          <Button
            variant="outline"
            size="xs"
            aria-label={`${open ? "Hide versions" : "Show versions"} of ${newest.appName ?? "Unknown app"}`}
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((shown) => !shown)}
          >
            {open ? "Hide versions" : "Show versions"}
          </Button>
        </p>
        {open ? (
          <ul id={listId} className="flex flex-col gap-0.5">
            {events.map((event) => (
              <li key={event.id} className="flex gap-3">
                <span className="w-14 shrink-0 text-label text-faint-foreground">
                  {formatDayMonth(dayOf(event))}
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
  if (entry.kind === "versions") return <VersionRun events={entry.events} />;
  const { event } = entry;
  const label = localizedLabel(
    CHANGE_FIELD_LABELS[event.field],
    event.localization,
  );

  return (
    <RowFrame event={event} field={label}>
      <ChangeValue event={event} dense={false} />
    </RowFrame>
  );
}
