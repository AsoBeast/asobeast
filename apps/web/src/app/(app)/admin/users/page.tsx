import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminListSkeleton } from "@/components/admin/skeletons";
import { getQueryClient } from "@/lib/get-query-client";
import { authStatusOptions, adminUsersOptions } from "@/lib/queries";
import { adminWorkspaceParser } from "@/lib/search-params";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = adminWorkspaceParser.parseServerSide(
    (await searchParams).workspace,
  );
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(adminUsersOptions(workspace ?? undefined)),
    queryClient.prefetchQuery(authStatusOptions),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<AdminListSkeleton />}>
        <AdminUsers />
      </Suspense>
    </HydrationBoundary>
  );
}
