"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDateInLocale } from "@/lib/format";
import { budgetOptions } from "@/lib/queries";
import { keywordLimitExceededSince } from "@/lib/quota-usage";
import { useAppLocale } from "@/lib/use-app-locale";

export function KeywordLimitNotice() {
  const t = useTranslations("billing");
  const locale = useAppLocale();
  const { data: budget } = useSuspenseQuery(budgetOptions);
  const since = keywordLimitExceededSince(budget.quota);

  if (!budget.quota || !since) return null;

  const limit = budget.quota.keywordMarkets.limit;

  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertDescription>
        {t(
          limit === null
            ? "keywordLimit.noticeUnlimited"
            : "keywordLimit.notice",
          {
            date: formatDateInLocale(since, locale),
            ...(limit === null ? {} : { limit }),
          },
        )}
      </AlertDescription>
    </Alert>
  );
}
