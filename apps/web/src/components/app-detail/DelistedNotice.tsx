"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AppDetail } from "@asobeast/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  formatCountryInLocale,
  formatDateInLocale,
  storeLabel,
} from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";

export function DelistedNotice({
  detail,
  since,
}: {
  detail: AppDetail;
  since: string;
}) {
  const t = useTranslations("appDetail");
  const locale = useAppLocale();
  const store = storeLabel(detail.store);
  const removal = t(
    detail.isCompetitor ? "delisted.goneCompetitor" : "delisted.goneApp",
  );
  return (
    <Alert variant="warning" role="note">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>{t("delisted.title", { store })}</AlertTitle>
      <AlertDescription>
        <p>
          {`${t("delisted.since", {
            date: formatDateInLocale(since, locale),
            store,
            id: detail.storeAppId,
            country: formatCountryInLocale(detail.country, locale),
          })} ${t("delisted.history")}`}
        </p>
        <p>{`${t("delisted.checkStore")} ${removal}`}</p>
      </AlertDescription>
    </Alert>
  );
}
