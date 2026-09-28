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
  void queryClient.prefetchQuery(actionSummaryOptions);
  await queryClient.prefetchQuery(actionsOptions(filters));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-wide @container/actions flex flex-col gap-6">
        <Suspense fallback={<ActionCenterSkeleton />}>
          <ActionCenter />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
}
