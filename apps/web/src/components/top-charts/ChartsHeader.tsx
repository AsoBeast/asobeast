import type { ReactNode } from "react";
import { FollowedCharts } from "./FollowedCharts";

export function ChartsHeader({ actions }: { actions: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-display tracking-tight text-balance">Top charts</h1>
        <p className="text-body text-muted-foreground">
          Free, paid and grossing charts by country and category, captured once
          a day.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FollowedCharts />
        {actions}
      </div>
    </div>
  );
}
