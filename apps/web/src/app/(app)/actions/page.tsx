import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ActionCenter } from "@/components/actions/ActionCenter";
import { ActionCenterSkeleton } from "@/components/actions/skeletons";
import { getQueryClient } from "@/lib/get-query-client";
import { actionsOptions, actionSummaryOptions } from "@/lib/queries";
import {
  actionFiltersFrom,
  type ActionSearchParams,
} from "@/lib/action-filters";

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<ActionSearchParams>;
}) {
  const filters = actionFiltersFrom(await searchParams);

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(actionsOptions(filters)),
    queryClient.prefetchQuery(actionSummaryOptions),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-wide flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-balance">Action Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What to do next and why. Every recommendation is computed
            deterministically from your stored data — open the evidence to see
            the exact numbers behind it.
          </p>
        </div>
        <Suspense fallback={<ActionCenterSkeleton />}>
          <ActionCenter />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
}
