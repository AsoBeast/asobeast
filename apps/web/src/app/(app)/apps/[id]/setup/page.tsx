import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { DISCOVERY_WINDOW_DAYS } from "@/components/onboarding/discovered-apps";
import { SetupChecklist } from "@/components/onboarding/SetupChecklist";
import { getQueryClient } from "@/lib/get-query-client";
import {
  appDetailOptions,
  competitorsOptions,
  discoveryOptions,
  keywordsOptions,
  marketSuggestionsOptions,
} from "@/lib/queries";

export default async function SetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const queryClient = getQueryClient();
  const app = await queryClient.fetchQuery(appDetailOptions(id));
  await Promise.all([
    queryClient.prefetchQuery(marketSuggestionsOptions(id)),
    queryClient.prefetchQuery(competitorsOptions(id)),
    queryClient.prefetchQuery(discoveryOptions(id, DISCOVERY_WINDOW_DAYS)),
    queryClient.prefetchQuery(keywordsOptions(id, app.country)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-reading">
        <SetupChecklist id={id} />
      </div>
    </HydrationBoundary>
  );
}
