import { cookies } from "next/headers";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { COMPETITOR_SECTIONS } from "@/components/competitors/competitor-sections";
import { CompetitorsView } from "@/components/competitors/CompetitorsView";
import {
  COLLAPSED_COOKIE_NAME,
  parseCollapsed,
} from "@/lib/collapsed-sections";
import { getQueryClient } from "@/lib/get-query-client";
import { comparisonOptions, competitorsOptions } from "@/lib/queries";
import { onlyGapsParser } from "@/lib/search-params";

export default async function CompetitorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onlyGaps?: string | string[] }>;
}) {
  const { id } = await params;
  const onlyGaps = onlyGapsParser.parseServerSide(
    (await searchParams).onlyGaps,
  );

  const collapsed = parseCollapsed(
    (await cookies()).get(COLLAPSED_COOKIE_NAME)?.value,
    COMPETITOR_SECTIONS,
  );

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(competitorsOptions(id)),
    queryClient.prefetchQuery(comparisonOptions(id, onlyGaps)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-full">
        <CompetitorsView id={id} collapsed={[...collapsed]} />
      </div>
    </HydrationBoundary>
  );
}
