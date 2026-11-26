"use client";

import { useTranslations } from "next-intl";
import { useSuspenseQuery } from "@tanstack/react-query";
import { LEDE } from "@/components/layout/panel-classes";
import { portfolioOptions } from "@/lib/queries";
import { dashboardLede } from "./movement-sentence";
import { useRangeHistory } from "./use-range-history";

export function DashboardLede() {
  const t = useTranslations("dashboard");
  const { history } = useRangeHistory();
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const parts = dashboardLede(history, portfolio.apps, t);
  return (
    <p className={LEDE}>
      {parts.map((part, index) => (
        <span key={`${part.key}-${index}`}>
          {t.rich(part.key, {
            ...part.values,
            strong: (chunks) => (
              <span className="font-medium text-foreground">{chunks}</span>
            ),
          })}
        </span>
      ))}
    </p>
  );
}
