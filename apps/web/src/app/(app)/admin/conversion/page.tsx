import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AdminConversion } from "@/components/admin/AdminConversion";
import { AdminConversionSkeleton } from "@/components/admin/skeletons";
import { CONVERSION_TAB_WINDOW } from "@/lib/admin-conversion";
import { getQueryClient } from "@/lib/get-query-client";
import { adminConversionOptions, adminDeparturesOptions } from "@/lib/queries";

export default async function AdminConversionPage() {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(adminConversionOptions(CONVERSION_TAB_WINDOW)),
    queryClient.prefetchQuery(adminDeparturesOptions),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<AdminConversionSkeleton />}>
        <AdminConversion />
      </Suspense>
    </HydrationBoundary>
  );
}
