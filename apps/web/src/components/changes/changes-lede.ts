import type { ChangeEventItem, ChangeImpactReport } from "@asobeast/shared";
import { formatDayMonth, pluralize } from "@/lib/format";
import { changeEffect, visibilityMove } from "./change-effects";
import { changedFieldWords, dayOf } from "./change-fields";

export interface LedePart {
  text: string;
  strong?: boolean;
}

function ownedFields(
  events: readonly ChangeEventItem[],
  article: string,
): string {
  const words = changedFieldWords(events.map((event) => event.field));
  return /^\d/.test(words) ? words : `${article} ${words}`;
}

function newestDayParts(events: readonly ChangeEventItem[]): LedePart[] {
  const day = events.map(dayOf).reduce((a, b) => (a > b ? a : b));
  const onDay = events.filter((event) => dayOf(event) === day);
  const own = onDay.filter((event) => !event.isCompetitor);
  const rivals = onDay.filter((event) => event.isCompetitor);
  const rivalIds = [...new Set(rivals.map((event) => event.appId))];

  const parts: LedePart[] = [
    { text: "On " },
    { text: formatDayMonth(day), strong: true },
    { text: " " },
  ];
  if (own.length > 0) {
    parts.push(
      { text: "you changed " },
      { text: ownedFields(own, "the"), strong: true },
    );
  }
  if (rivalIds.length > 0) {
    if (own.length > 0) parts.push({ text: "; " });
    if (rivalIds.length === 1) {
      parts.push(
        { text: rivals[0].appName ?? "A competitor", strong: true },
        { text: " changed " },
        { text: ownedFields(rivals, "its"), strong: true },
      );
    } else {
      parts.push(
        { text: pluralize(rivalIds.length, "competitor"), strong: true },
        { text: " changed their listings" },
      );
    }
  }
  parts.push({ text: "." });
  return parts;
}

function impactParts(impact: ChangeImpactReport): LedePart[] {
  const parts: LedePart[] = [];
  const [newest] = impact.items;
  const newestEffect = newest ? changeEffect(newest) : null;
  if (newestEffect?.kind === "pending") {
    parts.push({
      text: ` Your change of ${formatDayMonth(newest.changedOn)} is measurable on ${formatDayMonth(newestEffect.measurableOn)}.`,
    });
  }
  for (const item of impact.items) {
    const effect = changeEffect(item);
    if (effect?.kind !== "measured") continue;
    const fields = changedFieldWords(item.fields);
    parts.push(
      {
        text: ` Your ${fields} change of ${formatDayMonth(item.changedOn)} was followed by visibility `,
      },
      { text: visibilityMove(effect.change), strong: true },
      { text: ` after ${effect.days} days.` },
    );
    break;
  }
  return parts;
}

export function changesLede({
  events,
  impact,
  days,
}: {
  events: readonly ChangeEventItem[];
  impact: ChangeImpactReport | null;
  days: number;
}): LedePart[] {
  const measured = impact ? impactParts(impact) : [];
  if (events.length === 0) {
    return [
      {
        text: `No listing changes in the last ${days} days, yours or a competitor's.`,
      },
      ...measured,
    ];
  }
  return [...newestDayParts(events), ...measured];
}
