import { Suspense } from "react";
import { ChartSkeleton } from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import { PANEL_ACTION, PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ActionProgress,
  ActionProgressKey,
  ActionProgressTotals,
} from "./ActionProgress";
import { ActionWorkByScope } from "./ActionWorkByScope";
import { RAIL_COLUMN, TextLineSkeleton } from "./skeletons";
import type { SetQueueView } from "./use-queue-view";

export function ActionRail({
  appId,
  iconOf,
  setView,
}: {
  appId?: string;
  iconOf?: (appId: string) => string | null;
  setView: SetQueueView;
}) {
  return (
    <aside aria-label="Progress and open work" className={RAIL_COLUMN}>
      <section aria-labelledby="progress-heading">
        <Card>
          <CardHeader className={PANEL_HEADER}>
            <CardTitle asChild>
              <h2 id="progress-heading">Progress</h2>
            </CardTitle>
            <CardAction className={PANEL_ACTION}>
              <Suspense fallback={null}>
                <ActionProgressKey appId={appId} />
              </Suspense>
            </CardAction>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<ChartSkeleton height={CHART_HEIGHT.tall} />}>
              <ActionProgress appId={appId} />
            </Suspense>
          </CardContent>
          <CardFooter>
            <Suspense fallback={<TextLineSkeleton width="w-64" />}>
              <ActionProgressTotals appId={appId} />
            </Suspense>
          </CardFooter>
        </Card>
      </section>
      <ActionWorkByScope appId={appId} iconOf={iconOf} setView={setView} />
    </aside>
  );
}
