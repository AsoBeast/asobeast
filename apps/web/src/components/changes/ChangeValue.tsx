"use client";

import type { ChangeEventItem } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatNumberInLocale, formatPrice } from "@/lib/format";
import { changeFieldLabel } from "@/lib/change-field-label";
import { useAppLocale } from "@/lib/use-app-locale";
import { cn } from "@/lib/utils";
import { releaseNotesInline } from "./release-notes";
import { hasScreenshotDetail } from "./screenshot-change";
import { ScreenshotChangeValue } from "./ScreenshotChangeValue";
import { isStoreField } from "./store-change";
import { StoreChangeValue } from "./StoreChangeValue";

function text(value: string | null): string {
  return value === null || value === "" ? "—" : value;
}

function chars(
  value: string | null,
  t: ReturnType<typeof useTranslations>,
): string {
  return value === null ? "—" : t("value.chars", { count: Number(value) });
}

function price(
  value: string | null,
  currency: string | null | undefined,
  freeLabel: string,
): string {
  return value === null ? "—" : formatPrice(Number(value), currency, freeLabel);
}

function inlineNotes(value: string | null): string {
  return value === null ? "—" : text(releaseNotesInline(value));
}

function count(
  value: string | null,
  locale: ReturnType<typeof useAppLocale>,
): string {
  return value === null ? "—" : formatNumberInLocale(Number(value), locale);
}

export function ChangeValue({
  event,
  dense,
}: {
  event: ChangeEventItem;
  dense: boolean;
}) {
  const t = useTranslations("changes");
  const common = useTranslations("common");
  const locale = useAppLocale();
  const { field, before, after } = event;

  if (hasScreenshotDetail(event)) {
    return <ScreenshotChangeValue event={event} dense={dense} />;
  }

  if (isStoreField(field)) {
    return <StoreChangeValue event={event} dense={dense} />;
  }

  if (field === "icon") {
    return (
      <span className="text-muted-foreground">{t("value.iconUpdated")}</span>
    );
  }

  if (field === "whatsNew") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="break-words">
            <span className="text-muted-foreground">
              {t("value.whatsNewUpdated", {
                field: changeFieldLabel(field, t),
              })}
            </span>
            <span
              className={cn(
                "font-medium",
                dense ? null : "block whitespace-pre-line",
              )}
            >
              {dense ? inlineNotes(after) : text(after)}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          {t("value.previous", { value: inlineNotes(before) })}
        </TooltipContent>
      </Tooltip>
    );
  }

  let from: string;
  let to: string;
  if (field === "summary" || field === "description") {
    from = chars(before, t);
    to = chars(after, t);
  } else if (field === "price") {
    from = price(before, event.currency, common("free"));
    to = price(after, event.currency, common("free"));
  } else if (field === "screenshots") {
    from = count(before, locale);
    to = count(after, locale);
  } else {
    from = text(before);
    to = text(after);
  }

  return (
    <span className="break-words">
      <span className="text-muted-foreground line-through">{from}</span>
      <span className="mx-1.5 text-muted-foreground">→</span>
      <span className="font-medium">{to}</span>
    </span>
  );
}
