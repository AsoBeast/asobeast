import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { AdminOverviewSkeleton } from "@/components/admin/skeletons";
import { getQueryClient } from "@/lib/get-query-client";
import { adminConversionOptions, adminOverviewOptions } from "@/lib/queries";
import { loadAdminOverviewSearch } from "@/lib/search-params";

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { days } = loadAdminOverviewSearch(await searchParams);
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(adminOverviewOptions),
    queryClient.prefetchQuery(adminConversionOptions(days)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<AdminOverviewSkeleton />}>
        <AdminOverview />
      </Suspense>
    </HydrationBoundary>
  );
}
