"use client";

import { LEDE } from "@/components/layout/panel-classes";
import { movementLede } from "./movement-sentence";
import { useRangeHistory } from "./use-range-history";

export function DashboardLede() {
  const { days, history } = useRangeHistory();
  const { lead, fact, tail } = movementLede(history.change, days);
  return (
    <p className={LEDE}>
      <span>{lead}</span>
      <span className="font-medium text-foreground">{fact}</span>
      <span>{tail}</span>
    </p>
  );
}
