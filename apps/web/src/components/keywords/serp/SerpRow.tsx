import type { ReactNode } from "react";
import { Star } from "lucide-react";
import type { SerpEntryItem } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { AppIcon } from "@/components/AppIcon";
import { MatchedText } from "@/components/keyword-match/MatchedText";
import type { Moved } from "@/components/movement/movement-text";
import { Badge } from "@/components/ui/badge";
import { DeltaChip } from "@/components/ui/delta-chip";
import {
  formatCompactInLocale,
  formatDayMonthInLocale,
  formatRatingInLocale,
} from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { cn } from "@/lib/utils";
import type { SerpRole } from "./serp-csv";
import { movedOf } from "./serp-summary";

export const SERP_ROW_GRID =
  "grid grid-cols-[2.5rem_2.5rem_minmax(0,1fr)_auto] items-start gap-x-3 px-4 py-2.5 sm:grid-cols-[2.5rem_2.5rem_minmax(0,1fr)_auto_auto]";

export const serpRowId = (position: number) => `serp-row-${position}`;

function ratingSentence(
  average: number,
  count: number | null,
  t: ReturnType<typeof useTranslations>,
  locale: ReturnType<typeof useAppLocale>,
): string {
  const rating = formatRatingInLocale(average, locale);
  return count === null
    ? t("serp.row.rating", { rating })
    : t("serp.row.ratings", { rating, count });
}

function Rating({
  average,
  count,
}: {
  average: number | null;
  count: number | null;
}) {
  const t = useTranslations("keywordInspector");
  const locale = useAppLocale();
  if (average === null) return null;
  return (
    <span className="col-start-3 row-start-2 flex items-center text-caption text-muted-foreground sm:col-start-4 sm:row-start-1 sm:pt-0.5">
      <span aria-hidden className="flex items-center gap-1.5 numeric">
        <Star className="size-3 fill-current" />
        <span>{formatRatingInLocale(average, locale)}</span>
        {count === null ? null : (
          <span>{formatCompactInLocale(count, locale)}</span>
        )}
      </span>
      <span className="sr-only">
        {ratingSentence(average, count, t, locale)}
      </span>
    </span>
  );
}

function RoleBadge({ role }: { role: SerpRole }) {
  const t = useTranslations("keywordInspector");
  if (role === "you") {
    return <Badge variant="brand">{t("serp.row.you")}</Badge>;
  }
  return role === "competitor" ? (
    <Badge variant="secondary">{t("serp.row.competitor")}</Badge>
  ) : null;
}

export function SerpMovement({
  entry,
  period,
  noneText,
}: {
  entry: Moved;
  period: string;
  noneText: string;
}) {
  const t = useTranslations("keywordInspector");
  if (entry.movement === "new") {
    return (
      <>
        <span aria-hidden className="font-medium text-signal-up">
          {t("serp.row.new")}
        </span>
        <span className="sr-only">{t("serp.row.movementNew")}</span>
      </>
    );
  }
  if (entry.movement === "none" || entry.movement === "same") {
    return (
      <>
        <span aria-hidden className="text-muted-foreground">
          —
        </span>
        <span className="sr-only">
          {entry.movement === "same" ? t("serp.row.movementSame") : noneText}
        </span>
      </>
    );
  }
  const spoken =
    entry.movement === "up"
      ? t("serp.row.movementUp", {
          count: Math.abs(entry.delta ?? 0),
          previous: entry.previous ?? 0,
        })
      : t("serp.row.movementDown", {
          count: entry.delta ?? 0,
          previous: entry.previous ?? 0,
        });
  return (
    <>
      <span aria-hidden>
        <DeltaChip value={entry.delta} period={period} />
      </span>
      <span className="sr-only">{spoken}</span>
    </>
  );
}

export function SerpAppText({
  title,
  segments,
  developer,
  role,
}: {
  title: string;
  segments?: SerpEntryItem["titleSegments"];
  developer: string | null;
  role: SerpRole;
}) {
  return (
    <div className="col-start-3 row-start-1 flex min-w-0 flex-col gap-0.5">
      <span dir="auto" className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span translate="no" className="font-medium wrap-anywhere">
          <MatchedText segments={segments} fallback={title} />
        </span>
        <RoleBadge role={role} />
      </span>
      {developer ? (
        <span
          translate="no"
          dir="auto"
          className="text-caption text-muted-foreground wrap-anywhere"
        >
          {developer}
        </span>
      ) : null}
    </div>
  );
}

export function SerpRow({
  entry,
  role,
  comparedTo,
  actions,
}: {
  entry: SerpEntryItem;
  role: SerpRole;
  comparedTo: string | null;
  actions?: ReactNode;
}) {
  const t = useTranslations("keywordInspector");
  const locale = useAppLocale();
  const period = comparedTo
    ? t("serp.summary.period", {
        date: formatDayMonthInLocale(comparedTo, locale),
      })
    : "";
  return (
    <li
      id={serpRowId(entry.position)}
      data-slot="serp-row"
      tabIndex={-1}
      className={cn(
        SERP_ROW_GRID,
        "focus:outline-2 focus:-outline-offset-2 focus:outline-ring",
        role === "you" && "shadow-[inset_3px_0_0_var(--brand-mark)]",
      )}
    >
      <span className="col-start-1 row-span-2 row-start-1 flex flex-col items-end gap-0.5 text-right">
        <span className="numeric font-medium">{entry.position}</span>
        <span className="text-caption">
          <SerpMovement
            entry={movedOf(entry)}
            period={period}
            noneText={t("serp.summary.noEarlierPosition")}
          />
        </span>
      </span>
      <span className="col-start-2 row-span-2 row-start-1">
        <AppIcon src={entry.iconUrl ?? null} size={40} />
      </span>
      <SerpAppText
        title={entry.title}
        segments={entry.titleSegments}
        developer={entry.developer}
        role={role}
      />
      <Rating average={entry.ratingAvg} count={entry.ratingCount} />
      {actions ? (
        <div className="col-start-4 row-start-1 flex items-center gap-1 sm:col-start-5">
          {actions}
        </div>
      ) : null}
    </li>
  );
}
