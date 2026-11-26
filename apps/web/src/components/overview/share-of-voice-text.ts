import type { ShareOfVoice, ShareOfVoiceReason } from "@asobeast/shared";
import type { TranslationContext } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { formatMeasureFixedInLocale } from "@/lib/format";

export const formatShare = (value: number, locale: Locale = "en"): string =>
  `${formatMeasureFixedInLocale(value, locale)}%`;

export const shareReason = (
  reason: ShareOfVoiceReason | undefined,
  translator: TranslationContext["translator"],
): string => translator(`metrics.reasons.${reason ?? "notChecked"}`);

export const shareLine = (
  block: ShareOfVoice,
  context: TranslationContext,
): string =>
  block.current === null
    ? shareReason(block.reason, context.translator)
    : formatShare(block.current, context.locale);

export const competitorsCaption = (
  count: number,
  translator: TranslationContext["translator"],
): string => translator("metrics.competitors", { count });
