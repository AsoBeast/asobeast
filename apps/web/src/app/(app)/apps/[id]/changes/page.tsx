import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ChangeTimeline } from "@/components/changes/ChangeTimeline";
import { getQueryClient } from "@/lib/get-query-client";
import { changesOptions } from "@/lib/queries";

export default async function ChangesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(changesOptions(id, 90));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-wide">
        <ChangeTimeline id={id} />
      </div>
    </HydrationBoundary>
  );
}
