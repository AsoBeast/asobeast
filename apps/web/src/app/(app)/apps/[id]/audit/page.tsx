import { Suspense } from "react";
import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AuditPage as AuditPageView } from "@/components/audit/AuditPage";
import { ApiError } from "@/lib/api";
import { getQueryClient } from "@/lib/get-query-client";
import { auditHistoryOptions, auditOptions } from "@/lib/queries";
import { presetToRange } from "@/lib/ranges";
import { visibilityRangeParser } from "@/lib/search-params";

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const range = visibilityRangeParser.parseServerSide(query.range);
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.fetchQuery(auditOptions(id)).catch((err: unknown) => {
      if (err instanceof ApiError && err.envelope.statusCode === 404) {
        notFound();
      }
      throw err;
    }),
    queryClient.prefetchQuery(auditHistoryOptions(id, presetToRange(range))),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={null}>
        <AuditPageView appId={id} />
      </Suspense>
    </HydrationBoundary>
  );
}
