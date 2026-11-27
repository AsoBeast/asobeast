"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { META_LINE } from "@/components/layout/panel-classes";
import { useMarket } from "@/components/app-detail/use-market";
import {
  formatCompactInLocale,
  formatCountryInLocale,
  formatDateInLocale,
  formatPrice,
} from "@/lib/format";
import { queryMarket } from "@/lib/market";
import { appListingOptions } from "@/lib/queries";
import { useAppLocale } from "@/lib/use-app-locale";
import { cn } from "@/lib/utils";

export function SnapshotFacts({ id }: { id: string }) {
  const { market, home } = useMarket(id);
  const t = useTranslations("overview");
  const tc = useTranslations("common");
  const locale = useAppLocale();
  const country = queryMarket(market, home);
  const { data: detail } = useSuspenseQuery(appListingOptions(id, country));
  const snapshot = detail.latestSnapshot;
  const where =
    country === undefined
      ? ""
      : t("snapshot.market", {
          country: formatCountryInLocale(country, locale),
        });

  const facts = [
    snapshot?.installs != null
      ? t("snapshot.installs", {
          count: formatCompactInLocale(snapshot.installs, locale),
        })
      : null,
    snapshot?.version ? `v${snapshot.version}` : null,
    snapshot?.price != null
      ? formatPrice(snapshot.price, snapshot.currency, tc("free"))
      : null,
    snapshot
      ? t("snapshot.captured", {
          date: formatDateInLocale(snapshot.capturedAt, locale),
          market: where,
        })
      : null,
  ].filter((fact) => fact !== null);

  if (facts.length === 0) {
    return <p className={META_LINE}>{t("snapshot.empty")}</p>;
  }

  return (
    <ul className={cn(META_LINE, "flex flex-wrap items-center gap-x-2")}>
      {facts.map((fact, index) => (
        <li key={fact} className="flex items-center gap-x-2">
          {index > 0 ? <span aria-hidden>·</span> : null}
          <span>{fact}</span>
        </li>
      ))}
    </ul>
  );
}
