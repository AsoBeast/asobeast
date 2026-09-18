import { Suspense } from "react";
import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AuditPage as AuditPageView } from "@/components/audit/AuditPage";
import { ApiError } from "@/lib/api";
import { getQueryClient } from "@/lib/get-query-client";
import { auditHistoryOptions, auditOptions } from "@/lib/queries";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const queryClient = getQueryClient();
  await queryClient.fetchQuery(auditOptions(id)).catch((err: unknown) => {
    if (err instanceof ApiError && err.envelope.statusCode === 404) notFound();
    throw err;
  });
  void queryClient.prefetchQuery(auditHistoryOptions(id));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={null}>
        <AuditPageView appId={id} />
      </Suspense>
    </HydrationBoundary>
  );
}
