import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ActionCenter } from "@/components/actions/ActionCenter";
import { ActionCenterSkeleton } from "@/components/actions/skeletons";
import {
  actionActivityScope,
  actionFiltersFrom,
  type ActionSearchParams,
} from "@/lib/action-filters";
import { getQueryClient } from "@/lib/get-query-client";
import {
  actionActivityOptions,
  actionsOptions,
  actionSummaryFor,
  appDetailOptions,
} from "@/lib/queries";

export default async function AppActionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ActionSearchParams>;
}) {
  const { id } = await params;
  const filters = actionFiltersFrom(await searchParams);

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(actionSummaryFor(id));
  void queryClient.prefetchQuery(
    actionActivityOptions(actionActivityScope(id)),
  );
  await Promise.all([
    queryClient.prefetchQuery(appDetailOptions(id)),
    queryClient.prefetchQuery(actionsOptions(filters, id)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-wide @container/actions flex flex-col gap-6">
        <Suspense fallback={<ActionCenterSkeleton />}>
          <ActionCenter appId={id} />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
}
