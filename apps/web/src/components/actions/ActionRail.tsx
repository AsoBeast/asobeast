import { Suspense } from "react";
import { ChartSkeleton } from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import { ActionProgress } from "./ActionProgress";

export const RAIL_CLASS =
  "flex flex-col gap-6 @5xl/actions:sticky @5xl/actions:top-20 @5xl/actions:col-span-4 @5xl/actions:self-start";

export function ActionRail({ appId }: { appId?: string }) {
  return (
    <aside aria-label="Queue progress" className={RAIL_CLASS}>
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
    </aside>
  );
}
