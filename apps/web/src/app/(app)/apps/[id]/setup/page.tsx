import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { SetupChecklist } from "@/components/onboarding/SetupChecklist";
import { getQueryClient } from "@/lib/get-query-client";
import {
  appDetailOptions,
  budgetOptions,
  competitorsOptions,
  emailAlertsOptions,
  keywordsOptions,
  webhooksOptions,
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
    queryClient.prefetchQuery(competitorsOptions(id)),
    queryClient.prefetchQuery(keywordsOptions(id, undefined, app.country)),
    queryClient.prefetchQuery(budgetOptions),
    queryClient.prefetchQuery(webhooksOptions),
    queryClient.prefetchQuery(emailAlertsOptions),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-reading">
        <SetupChecklist id={id} />
      </div>
    </HydrationBoundary>
  );
}
