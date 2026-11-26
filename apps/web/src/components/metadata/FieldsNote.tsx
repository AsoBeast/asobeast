"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMarket } from "@/components/app-detail/use-market";
import { LOCALIZATIONS_SECTION_ID } from "@/lib/app-localizations";
import { formatDateInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { queryMarket } from "@/lib/market";
import { appListingOptions } from "@/lib/queries";

export function FieldsNote({
  id,
  keywordFields,
}: {
  id: string;
  keywordFields: boolean;
}) {
  const t = useTranslations("metadata");
  const locale = useAppLocale();
  const { market, home } = useMarket(id);
  const { data } = useQuery({
    ...appListingOptions(id, queryMarket(market, home)),
    retry: false,
  });
  const capturedAt = data?.latestSnapshot?.capturedAt ?? null;

  return (
    <p className="text-caption text-faint-foreground">
      {capturedAt ? (
        <span>
          {t("snapshot", { date: formatDateInLocale(capturedAt, locale) })}
        </span>
      ) : null}
      <span>{t("scratchPad")}</span>
      {keywordFields ? (
        <>
          <span>{t("keywordFieldSavedUnder")}</span>
          <a
            href={`#${LOCALIZATIONS_SECTION_ID}`}
            className="text-foreground link-underline"
          >
            {t("appStoreLocalizations")}
          </a>
          <span>.</span>
        </>
      ) : null}
    </p>
  );
}
