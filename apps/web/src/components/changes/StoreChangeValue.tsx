"use client";

import type { AppEventRef, ChangeEventItem, StoryRef } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { changeFieldLabel } from "@/lib/change-field-label";
import { useAppLocale } from "@/lib/use-app-locale";
import { cn } from "@/lib/utils";
import {
  eventMeta,
  eventTitle,
  storyTitle,
  storeChangeSummary,
} from "./store-change";

const REMOVED_TONE = "text-muted-foreground line-through";
const ADDED_TONE = "font-medium";
const META_TONE = "text-faint-foreground";

function GroupLabel({ label }: { label: string }) {
  return (
    <span className="w-16 shrink-0 text-label text-faint-foreground">
      {label}
    </span>
  );
}

function EventGroup({
  label,
  refs,
  tone,
}: {
  label: string;
  refs: AppEventRef[];
  tone: string;
}) {
  const t = useTranslations("changes");
  const locale = useAppLocale();
  if (refs.length === 0) return null;
  return (
    <span className="flex gap-3">
      <GroupLabel label={label} />
      <span className="flex min-w-0 flex-col gap-0.5">
        {refs.map((ref) => {
          const meta = eventMeta(ref, t, locale);
          return (
            <span key={ref.appEventId} className="wrap-anywhere">
              <span className={tone}>{eventTitle(ref, t)}</span>
              {meta ? <span className={META_TONE}>{` · ${meta}`}</span> : null}
            </span>
          );
        })}
      </span>
    </span>
  );
}

function StoryGroup({
  label,
  refs,
  tone,
}: {
  label: string;
  refs: StoryRef[];
  tone: string;
}) {
  const t = useTranslations("changes");
  if (refs.length === 0) return null;
  return (
    <span className="flex gap-3">
      <GroupLabel label={label} />
      <span className="flex min-w-0 flex-col gap-0.5">
        {refs.map((ref) => {
          const kicker =
            ref.title !== null && ref.heading !== null ? ref.heading : null;
          return (
            <span key={ref.storyId} className="wrap-anywhere">
              {kicker ? (
                <span className={META_TONE}>{`${kicker} · `}</span>
              ) : null}
              <span className={tone}>{storyTitle(ref, t)}</span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

export function StoreChangeValue({
  event,
  dense,
}: {
  event: ChangeEventItem;
  dense: boolean;
}) {
  const t = useTranslations("changes");
  const detail = event.detail;
  const fallback = t("value.updated", {
    field: changeFieldLabel(event.field, t),
  });
  const summary = detail ? storeChangeSummary(event, t) : "";

  if (dense || summary === "") {
    return (
      <span className="break-words">{summary === "" ? fallback : summary}</span>
    );
  }

  if (detail?.kind === "events") {
    return (
      <span className="flex min-w-0 flex-col gap-1">
        <EventGroup
          label={t("value.removed")}
          refs={detail.removed}
          tone={REMOVED_TONE}
        />
        <EventGroup
          label={t("value.added")}
          refs={detail.added}
          tone={ADDED_TONE}
        />
      </span>
    );
  }

  if (detail?.kind === "featuring") {
    return (
      <span className="flex min-w-0 flex-col gap-1">
        <StoryGroup
          label={t("value.removed")}
          refs={detail.removed}
          tone={REMOVED_TONE}
        />
        <StoryGroup
          label={t("value.added")}
          refs={detail.added}
          tone={ADDED_TONE}
        />
      </span>
    );
  }

  if (detail?.kind === "editorsChoice") {
    return (
      <span className="flex min-w-0 flex-col gap-1">
        <span className="wrap-anywhere">
          <span className="font-medium">{summary}</span>
        </span>
        {detail.notes ? (
          <span className={cn("wrap-anywhere", META_TONE)}>{detail.notes}</span>
        ) : null}
      </span>
    );
  }

  return <span className="break-words">{fallback}</span>;
}
