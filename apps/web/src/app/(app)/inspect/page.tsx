import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { InspectView } from "@/components/keyword-inspections/InspectView";
import { getQueryClient } from "@/lib/get-query-client";
import { keywordInspectionsOptions } from "@/lib/queries";

export default async function InspectPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(keywordInspectionsOptions);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-wide @container/inspect flex flex-col gap-6">
        <InspectView />
      </div>
    </HydrationBoundary>
  );
}
