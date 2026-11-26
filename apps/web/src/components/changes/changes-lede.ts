import type {
  ChangeEventItem,
  ChangeField,
  ChangeImpactReport,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enChanges from "../../../messages/en/changes.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatDayMonthInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { changeEffect, visibilityMove } from "./change-effects";
import {
  attributeFields,
  changedFieldWords,
  dayOf,
  fieldPhrase,
  namesFields,
} from "./change-fields";

const english = createTranslator({
  locale: "en",
  namespace: "changes",
  messages: { changes: enChanges },
});

interface Copy {
  t: MessageTranslator;
  locale: Locale;
}

const DEFAULT_COPY: Copy = { t: english, locale: "en" };

export interface LedePart {
  text: string;
  strong?: boolean;
}

function newestDayParts(
  events: readonly ChangeEventItem[],
  copy: Copy,
): LedePart[] {
  const { t, locale } = copy;
  const day = events.map(dayOf).reduce((a, b) => (a > b ? a : b));
  const onDay = events.filter((event) => dayOf(event) === day);
  const own = onDay.filter((event) => !event.isCompetitor);
  const rivals = onDay.filter((event) => event.isCompetitor);
  const rivalIds = [...new Set(rivals.map((event) => event.appId))];
  const { yours, storeDecided } = attributeFields(
    own.map((event) => event.field),
  );

  const parts: LedePart[] = [
    { text: t("lede.on") },
    { text: formatDayMonthInLocale(day, locale), strong: true },
    { text: t("lede.separator") },
  ];
  const segments = [
    editedParts(yours, copy),
    storeDecidedParts(storeDecided, copy),
    rivalParts(rivals, rivalIds, copy),
  ].filter((segment) => segment.length > 0);
  segments.forEach((segment, index) => {
    if (index > 0) parts.push({ text: t("lede.segmentSeparator") });
    parts.push(...segment);
  });
  parts.push({ text: t("lede.end") });
  return parts;
}

function editedParts(yours: readonly ChangeField[], copy: Copy): LedePart[] {
  if (yours.length === 0) return [];
  return [
    { text: copy.t("lede.youChanged") },
    { text: fieldPhrase(yours, "the", copy.t, copy.locale), strong: true },
  ];
}

function storeDecidedParts(
  storeDecided: readonly ChangeField[],
  copy: Copy,
): LedePart[] {
  if (storeDecided.length === 0) return [];
  return [
    { text: copy.t("lede.storeChanged") },
    {
      text: fieldPhrase(storeDecided, "the", copy.t, copy.locale),
      strong: true,
    },
  ];
}

function rivalParts(
  rivals: readonly ChangeEventItem[],
  rivalIds: readonly string[],
  copy: Copy,
): LedePart[] {
  const { t, locale } = copy;
  if (rivalIds.length === 1) {
    return [
      { text: rivals[0].appName ?? t("lede.aCompetitor"), strong: true },
      { text: t("lede.rivalChanged") },
      {
        text: fieldPhrase(
          rivals.map((event) => event.field),
          "its",
          t,
          locale,
        ),
        strong: true,
      },
    ];
  }
  if (rivalIds.length > 1) {
    return [
      {
        text: t("lede.competitorCount", { count: rivalIds.length }),
        strong: true,
      },
      { text: t("lede.rivalsChanged") },
    ];
  }
  return [];
}

function impactParts(impact: ChangeImpactReport, copy: Copy): LedePart[] {
  const { t, locale } = copy;
  const parts: LedePart[] = [];
  const [newest] = impact.items;
  const newestEffect = newest ? changeEffect(newest) : null;
  if (newestEffect?.kind === "pending") {
    parts.push({
      text: t("lede.pending", {
        changed: formatDayMonthInLocale(newest.changedOn, locale),
        measurable: formatDayMonthInLocale(newestEffect.measurableOn, locale),
      }),
    });
  }
  for (const item of impact.items) {
    const effect = changeEffect(item);
    if (effect?.kind !== "measured") continue;
    const subject = namesFields(item.fields)
      ? t("lede.measuredSubject", {
          fields: changedFieldWords(item.fields, t, locale),
        })
      : t("lede.measuredGeneric");
    parts.push(
      {
        text: t("lede.measured", {
          subject,
          changed: formatDayMonthInLocale(item.changedOn, locale),
        }),
      },
      { text: visibilityMove(effect.change, t, locale), strong: true },
      { text: t("lede.afterDays", { days: effect.days }) },
    );
    break;
  }
  return parts;
}

export function changesLede(
  {
    events,
    impact,
    days,
  }: {
    events: readonly ChangeEventItem[];
    impact: ChangeImpactReport | null;
    days: number;
  },
  copy: Copy = DEFAULT_COPY,
): LedePart[] {
  const measured = impact ? impactParts(impact, copy) : [];
  if (events.length === 0) {
    return [{ text: copy.t("lede.none", { days }) }, ...measured];
  }
  return [...newestDayParts(events, copy), ...measured];
}
