import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AdminWorkspaces } from "@/components/admin/AdminWorkspaces";
import { AdminListSkeleton } from "@/components/admin/skeletons";
import { getQueryClient } from "@/lib/get-query-client";
import { authStatusOptions, adminWorkspacesOptions } from "@/lib/queries";

export default async function AdminWorkspacesPage() {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(adminWorkspacesOptions),
    queryClient.prefetchQuery(authStatusOptions),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<AdminListSkeleton />}>
        <AdminWorkspaces />
      </Suspense>
    </HydrationBoundary>
  );
}
