import { Suspense } from "react";
import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AuditHealthChart } from "@/components/audit/AuditHealthChart";
import { AuditView } from "@/components/audit/AuditView";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, getAudit } from "@/lib/api";
import { getQueryClient } from "@/lib/get-query-client";
import { auditHistoryOptions } from "@/lib/queries";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const audit = await getAudit(id).catch((err) => {
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

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(auditHistoryOptions(id));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-reading flex flex-col gap-8">
        <Suspense
          fallback={<Skeleton className="h-[336px] w-full rounded-xl" />}
        >
          <AuditHealthChart id={id} />
        </Suspense>
        <AuditView appId={id} audit={audit} />
      </div>
    </HydrationBoundary>
  );
}
