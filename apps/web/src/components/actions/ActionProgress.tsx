"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { actionActivityScope } from "@/lib/action-filters";
import { actionActivityOptions } from "@/lib/queries";
import { ActionActivityChart } from "./ActionActivityChart";
import { activityTotalsLine } from "./activity-chart";

export function ActionProgress({ appId }: { appId?: string }) {
  const { data: activity } = useSuspenseQuery(
    actionActivityOptions(actionActivityScope(appId)),
  );

  return (
    <div className="flex flex-col gap-3">
      <ActionActivityChart activity={activity} />
      <p className="text-caption text-muted-foreground">
        {activityTotalsLine(activity)}
      </p>
    </div>
  );
}
