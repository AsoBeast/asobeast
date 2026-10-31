import type { ReactNode } from "react";
import { Star } from "lucide-react";
import type { SerpEntryItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { MatchedText } from "@/components/keyword-match/MatchedText";
import { MovementCell } from "@/components/movement/MovementCell";
import { Badge } from "@/components/ui/badge";
import {
  formatCompact,
  formatDayMonth,
  formatRating,
  pluralize,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SerpRole } from "./serp-csv";
import { movedOf } from "./serp-summary";

export const SERP_ROW_GRID =
  "grid grid-cols-[2.5rem_2.5rem_minmax(0,1fr)_auto] items-start gap-x-3 px-4 py-2.5 sm:grid-cols-[2.5rem_2.5rem_minmax(0,1fr)_auto_auto]";

export const serpRowId = (position: number) => `serp-row-${position}`;

function ratingSentence(average: number, count: number | null): string {
  const rated = `Rated ${formatRating(average)}`;
  return count === null ? rated : `${rated} from ${pluralize(count, "rating")}`;
}

function Rating({
  average,
  count,
}: {
  average: number | null;
  count: number | null;
}) {
  if (average === null) return null;
  return (
    <span className="col-start-3 row-start-2 flex items-center text-caption text-muted-foreground sm:col-start-4 sm:row-start-1 sm:pt-0.5">
      <span aria-hidden className="flex items-center gap-1.5 numeric font-mono">
        <Star className="size-3 fill-current" />
        <span>{formatRating(average)}</span>
        {count === null ? null : <span>{formatCompact(count)}</span>}
      </span>
      <span className="sr-only">{ratingSentence(average, count)}</span>
    </span>
  );
}

function RoleBadge({ role }: { role: SerpRole }) {
  if (role === "you") {
    return (
      <Badge variant="outline" className="border-info text-info">
        You
      </Badge>
    );
  }
  return role === "competitor" ? (
    <Badge variant="secondary">Competitor</Badge>
  ) : null;
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
  return (
    <li
      id={serpRowId(entry.position)}
      tabIndex={-1}
      className={cn(
        SERP_ROW_GRID,
        "focus:outline-2 focus:-outline-offset-2 focus:outline-ring",
        role === "you" && "bg-info-subtle shadow-[inset_3px_0_0_var(--info)]",
      )}
    >
      <span className="col-start-1 row-span-2 row-start-1 flex flex-col items-end gap-0.5 text-right">
        <span className="numeric font-mono font-medium">{entry.position}</span>
        <span className="text-caption">
          <MovementCell
            entry={movedOf(entry)}
            period={comparedTo ? `since ${formatDayMonth(comparedTo)}` : ""}
            noneText="No earlier position"
            compact
          />
        </span>
      </span>
      <span className="col-start-2 row-span-2 row-start-1">
        <AppIcon src={entry.iconUrl ?? null} name={entry.title} size={40} />
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
