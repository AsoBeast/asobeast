import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AdminCapacity } from "@/components/admin/AdminCapacity";
import { AdminCapacitySkeleton } from "@/components/admin/skeletons";
import { getQueryClient } from "@/lib/get-query-client";
import {
  adminCapacityOptions,
  adminProxyPoolOptions,
  adminWorkspacesOptions,
} from "@/lib/queries";

export default async function AdminCapacityPage() {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(adminCapacityOptions),
    queryClient.prefetchQuery(adminProxyPoolOptions),
    queryClient.prefetchQuery(adminWorkspacesOptions),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<AdminCapacitySkeleton />}>
        <AdminCapacity />
      </Suspense>
    </HydrationBoundary>
  );
}
