"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { LEDE } from "@/components/layout/panel-classes";
import { portfolioOptions } from "@/lib/queries";
import { dashboardLede } from "./movement-sentence";
import { useRangeHistory } from "./use-range-history";

export function DashboardLede() {
  const { history } = useRangeHistory();
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const parts = dashboardLede(history, portfolio.apps).filter(
    (part) => part.text !== "",
  );
  return (
    <p className={LEDE}>
      {parts.map((part, index) => (
        <span
          key={index}
          className={part.strong ? "font-medium text-foreground" : undefined}
        >
          {part.text}
        </span>
      ))}
    </p>
  );
}
