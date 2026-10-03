import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { AdminOverviewSkeleton } from "@/components/admin/skeletons";
import { getQueryClient } from "@/lib/get-query-client";
import { adminOverviewOptions } from "@/lib/queries";

export default async function AdminOverviewPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(adminOverviewOptions);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<AdminOverviewSkeleton />}>
        <AdminOverview />
      </Suspense>
    </HydrationBoundary>
  );
}
