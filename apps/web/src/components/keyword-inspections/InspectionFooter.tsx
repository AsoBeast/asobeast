"use client";

import type { KeywordInspection } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { formatDateTimeInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { storefrontName } from "./inspection-format";
import { InspectionSource } from "./InspectionScores";

export function InspectionFooter({
  inspection,
}: {
  inspection: KeywordInspection;
}) {
  const t = useTranslations("keywordInspector");
  const locale = useAppLocale();
  const place = storefrontName(inspection.store, inspection.country, locale);
  const when =
    inspection.status === "DONE" && inspection.completedAt
      ? formatDateTimeInLocale(inspection.completedAt, locale)
      : t("inspector.detail.requestedAt", {
          date: formatDateTimeInLocale(inspection.requestedAt, locale),
        });
  return (
    <>
      <span>{`${place} · ${when}`}</span>
      {inspection.status === "DONE" ? (
        <InspectionSource inspection={inspection} />
      ) : null}
    </>
  );
}
