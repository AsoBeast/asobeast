import { Suspense } from "react";
import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AuditView } from "@/components/audit/AuditView";
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
  const audit = await queryClient.fetchQuery(auditOptions(id)).catch((err) => {
    if (err instanceof ApiError && err.envelope.statusCode === 404) notFound();
    return null;
  });
  if (!audit) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Audit is not available for this app yet.
      </div>
    );
  }
  void queryClient.prefetchQuery(auditHistoryOptions(id));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={null}>
        <AuditView appId={id} />
      </Suspense>
    </HydrationBoundary>
  );
}
