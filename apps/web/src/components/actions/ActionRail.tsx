import { Suspense } from "react";
import { ChartSkeleton } from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import { ActionProgress } from "./ActionProgress";
import { ActionWorkByScope } from "./ActionWorkByScope";
import { RAIL_COLUMN } from "./skeletons";
import type { SetQueueView } from "./use-queue-view";

export function ActionRail({
  appId,
  setView,
}: {
  appId?: string;
  setView: SetQueueView;
}) {
  return (
    <aside aria-label="Queue progress" className={RAIL_COLUMN}>
      <section
        aria-labelledby="progress-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="progress-heading" className="text-title">
          Progress
        </h2>
        <Suspense fallback={<ChartSkeleton height={CHART_HEIGHT.compact} />}>
          <ActionProgress appId={appId} />
        </Suspense>
      </section>
      <ActionWorkByScope appId={appId} setView={setView} />
    </aside>
  );
}
