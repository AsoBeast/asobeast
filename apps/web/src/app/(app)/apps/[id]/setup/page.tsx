import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { DISCOVERY_WINDOW_DAYS } from "@/components/onboarding/discovered-apps";
import { SetupChecklist } from "@/components/onboarding/SetupChecklist";
import { getQueryClient } from "@/lib/get-query-client";
import {
  appDetailOptions,
  competitorsOptions,
  discoveryOptions,
  firstRunOptions,
  keywordsOptions,
  marketSuggestionsOptions,
  pickerSuggestionsOptions,
  setupOptions,
} from "@/lib/queries";

export default async function SetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const queryClient = getQueryClient();
  const app = await queryClient.fetchQuery(appDetailOptions(id));
  if (app.isCompetitor) notFound();
  await Promise.all([
    queryClient.prefetchQuery(setupOptions(id)),
    queryClient.prefetchQuery(marketSuggestionsOptions(id)),
    queryClient.prefetchQuery(competitorsOptions(id)),
    queryClient.prefetchQuery(firstRunOptions(id)),
    queryClient.prefetchQuery(discoveryOptions(id, DISCOVERY_WINDOW_DAYS)),
    queryClient.prefetchQuery(keywordsOptions(id, app.country)),
    queryClient.prefetchQuery(
      pickerSuggestionsOptions(id, "metadata", app.country),
    ),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-reading">
        <SetupChecklist id={id} />
      </div>
    </HydrationBoundary>
  );
}
