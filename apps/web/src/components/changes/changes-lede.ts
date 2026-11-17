import type {
  ChangeEventItem,
  ChangeField,
  ChangeImpactReport,
} from "@asobeast/shared";
import { formatDayMonth, pluralize } from "@/lib/format";
import { changeEffect, visibilityMove } from "./change-effects";
import {
  attributeFields,
  changedFieldWords,
  dayOf,
  fieldPhrase,
  namesFields,
} from "./change-fields";

export interface LedePart {
  text: string;
  strong?: boolean;
}

function newestDayParts(events: readonly ChangeEventItem[]): LedePart[] {
  const day = events.map(dayOf).reduce((a, b) => (a > b ? a : b));
  const onDay = events.filter((event) => dayOf(event) === day);
  const own = onDay.filter((event) => !event.isCompetitor);
  const rivals = onDay.filter((event) => event.isCompetitor);
  const rivalIds = [...new Set(rivals.map((event) => event.appId))];
  const { yours, storeDecided } = attributeFields(
    own.map((event) => event.field),
  );

  const parts: LedePart[] = [
    { text: "On " },
    { text: formatDayMonth(day), strong: true },
    { text: ", " },
  ];
  const segments = [
    editedParts(yours),
    storeDecidedParts(storeDecided),
    rivalParts(rivals, rivalIds),
  ].filter((segment) => segment.length > 0);
  segments.forEach((segment, index) => {
    if (index > 0) parts.push({ text: "; " });
    parts.push(...segment);
  });
  parts.push({ text: "." });
  return parts;
}

function editedParts(yours: readonly ChangeField[]): LedePart[] {
  if (yours.length === 0) return [];
  return [
    { text: "you changed " },
    { text: fieldPhrase(yours, "the"), strong: true },
  ];
}

function storeDecidedParts(storeDecided: readonly ChangeField[]): LedePart[] {
  if (storeDecided.length === 0) return [];
  return [
    { text: "the store changed " },
    { text: fieldPhrase(storeDecided, "the"), strong: true },
  ];
}

function rivalParts(
  rivals: readonly ChangeEventItem[],
  rivalIds: readonly string[],
): LedePart[] {
  if (rivalIds.length === 1) {
    return [
      { text: rivals[0].appName ?? "A competitor", strong: true },
      { text: " changed " },
      {
        text: fieldPhrase(
          rivals.map((event) => event.field),
          "its",
        ),
        strong: true,
      },
    ];
  }
  if (rivalIds.length > 1) {
    return [
      { text: pluralize(rivalIds.length, "competitor"), strong: true },
      { text: " changed their listings" },
    ];
  }
  return [];
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
    const subject = namesFields(item.fields)
      ? `Your ${changedFieldWords(item.fields)} change`
      : "Your change";
    parts.push(
      {
        text: ` ${subject} of ${formatDayMonth(item.changedOn)} was followed by visibility `,
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
