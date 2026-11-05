import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AlertFeed } from "@/components/alerts/AlertFeed";
import { AlertFeedSkeleton } from "@/components/alerts/AlertFeedStates";
import { getQueryClient } from "@/lib/get-query-client";
import { alertEventFilters, alertEventsOptions } from "@/lib/queries";
import { loadAlertFeedSearch } from "@/lib/search-params";

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const view = loadAlertFeedSearch(await searchParams);
  const queryClient = getQueryClient();
  await queryClient.prefetchInfiniteQuery(
    alertEventsOptions(alertEventFilters(view)),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-wide @container/alerts flex flex-col gap-6">
        <Suspense fallback={<AlertFeedSkeleton />}>
          <AlertFeed />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
}
