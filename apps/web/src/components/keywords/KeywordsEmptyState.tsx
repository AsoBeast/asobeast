"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCountryInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";

export function KeywordsEmptyState({
  country,
  onFindKeywords,
}: {
  country: string;
  onFindKeywords?: (leaving: HTMLElement) => void;
}) {
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  return (
    <EmptyState
      title={t("empty.title", {
        country: formatCountryInLocale(country, locale),
      })}
      body={t("empty.body")}
      action={
        onFindKeywords ? (
          <Button
            variant="outline"
            size="sm"
            onClick={(event) => onFindKeywords(event.currentTarget)}
          >
            {t("empty.find")}
          </Button>
        ) : null
      }
    />
  );
}
