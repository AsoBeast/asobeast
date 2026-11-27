"use client";

import { createTranslator, useTranslations } from "next-intl";
import { listsNoApps, type TrackedKeywordItem } from "@asobeast/shared";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
import { PositionDeltaChip } from "@/components/ui/delta-chip";
import { GradedNumber } from "@/components/ui/graded";
import { formatDateInLocale } from "@/lib/format";
import { grade, type Grade } from "@/lib/grade";
import type { LostPosition } from "@/lib/keyword-checks";
import type { Locale } from "@/lib/locale";
import { useAppLocale } from "@/lib/use-app-locale";
import { cn } from "@/lib/utils";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export const lastRankedLine = (
  position: number,
  on: string,
  t: MessageTranslator = english,
  locale: Locale = "en",
) =>
  t("position.lastRanked", {
    position,
    date: formatDateInLocale(on, locale),
  });

const CHIP = "h-6 min-w-9 justify-center rounded-md px-1.5 font-semibold";

const CHIP_TIER: Partial<Record<Grade, string>> = {
  strong: "bg-signal-up-subtle text-signal-up",
  fair: "bg-secondary shadow-[inset_0_0_0_1px_var(--border)]",
};

export const positionChipClass = (tier: Grade | null): string =>
  cn(CHIP, tier && CHIP_TIER[tier]);

export function PositionReadout({
  keyword,
  label,
  staleOn,
  lost = null,
  chip = false,
  className,
}: {
  keyword: TrackedKeywordItem;
  label: string;
  staleOn: string | null;
  lost?: LostPosition | null;
  chip?: boolean;
  className?: string;
}) {
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  const tier = grade("position", keyword.latestPosition);
  const noApps =
    keyword.latestPosition === null && listsNoApps(keyword.latestResultCount);
  const lostTitle = lost?.on
    ? lastRankedLine(lost.position, lost.on, t, locale)
    : undefined;
  const title =
    [noApps ? t("position.noAppsSentence") : null, lostTitle]
      .filter((part): part is string => Boolean(part))
      .join(". ") || undefined;
  const worded =
    keyword.latestDepth !== null && keyword.latestDepth !== undefined;
  const name = [
    noApps
      ? `${t("position.noApps")}: ${t("position.noAppsSentence")}`
      : t("position.notFound", { depth: keyword.latestDepth ?? 0 }),
    lostTitle ?? (lost ? `was #${lost.position}` : null),
  ]
    .filter((part): part is string => part !== null)
    .join(", ");
  return (
    <span
      className={cn(
        "numeric inline-flex shrink-0 items-center gap-1.5",
        chip && "min-w-12",
      )}
    >
      {keyword.latestPosition === null ? (
        <span
          title={title}
          className={cn(
            "flex flex-col leading-tight text-muted-foreground",
            className,
          )}
        >
          <span aria-hidden={worded || undefined}>{label}</span>
          {lost ? (
            <span className="text-tick text-faint-foreground">
              {t("position.was", { position: lost.position })}
            </span>
          ) : null}
          {worded ? <span className="sr-only">{name}</span> : null}
        </span>
      ) : (
        <GradedNumber
          value={label}
          grade={tier}
          label={t("position.label")}
          marker={!chip}
          className={cn(chip && positionChipClass(tier), className)}
        />
      )}
      {chip ? null : (
        <PositionDeltaChip
          value={staleOn === null ? keyword.positionDelta1d : null}
        />
      )}
    </span>
  );
}
