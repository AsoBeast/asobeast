"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { AlertTriangle, CircleCheck, CircleHelp } from "lucide-react";
import {
  isStorefront,
  type MarketAvailability,
  type Store,
} from "@asobeast/shared";
import { formatCountryInLocale } from "@/lib/format";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { useAppLocale } from "@/lib/use-app-locale";
import { marketAvailabilityOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<
  MarketAvailability,
  { icon: typeof CircleCheck; className: string }
> = {
  available: {
    icon: CircleCheck,
    className: "text-success",
  },
  unavailable: {
    icon: AlertTriangle,
    className: "text-warning",
  },
  unknown: { icon: CircleHelp, className: "text-muted-foreground" },
};

function statusLabel(
  status: MarketAvailability,
  country: string,
  t: MessageTranslator,
  locale: Locale,
): string {
  const market = formatCountryInLocale(country, locale);
  if (status === "available") {
    return t("market.available", { market });
  }
  if (status === "unavailable") {
    return t("market.unavailable", { market });
  }
  return t("market.unknown", { market });
}

export function MarketAvailabilityNotice({
  appId,
  store,
  country,
}: {
  appId: string;
  store: Store;
  country: string;
}) {
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  const valid = isStorefront(store, country);
  const { data, isError } = useQuery({
    ...marketAvailabilityOptions(appId, country),
    enabled: valid,
  });

  const status: MarketAvailability | undefined = valid
    ? (data?.status ?? (isError ? "unknown" : undefined))
    : undefined;
  const style = status ? STATUS_STYLE[status] : null;
  const Icon = style?.icon;

  return (
    <p
      aria-live="polite"
      className={cn(
        "flex min-h-5 items-center gap-1.5 text-caption",
        style?.className ?? "text-muted-foreground",
      )}
    >
      {status && Icon ? (
        <>
          <Icon className="size-3.5 shrink-0" aria-hidden />
          <span>{statusLabel(status, country, t, locale)}</span>
        </>
      ) : null}
    </p>
  );
}
