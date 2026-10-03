import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AdminApps } from "@/components/admin/AdminApps";
import { AdminListSkeleton } from "@/components/admin/skeletons";
import { getQueryClient } from "@/lib/get-query-client";
import { adminAppsOptions, adminOverviewOptions } from "@/lib/queries";
import { adminWorkspaceParser } from "@/lib/search-params";

export default async function AdminAppsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = adminWorkspaceParser.parseServerSide(
    (await searchParams).workspace,
  );
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(adminAppsOptions(workspace ?? undefined)),
    queryClient.prefetchQuery(adminOverviewOptions),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<AdminListSkeleton />}>
        <AdminApps />
      </Suspense>
    </HydrationBoundary>
  );
}
