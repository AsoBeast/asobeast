import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/get-query-client";
import {
  actionsOptions,
  actionSummaryOptions,
  budgetOptions,
  portfolioOptions,
  recentChangesOptions,
} from "@/lib/queries";
import { AppsDashboard } from "@/components/apps/AppsDashboard";
import { FirstRun } from "@/components/apps/FirstRun";
import { PortfolioSummary } from "@/components/apps/PortfolioSummary";
import { ImportAppDialog } from "@/components/apps/ImportAppDialog";
import {
  AppsDashboardSkeleton,
  PortfolioTotalsSkeleton,
} from "@/components/apps/skeletons";
import { Button } from "@/components/ui/button";
import { BudgetBanner } from "@/components/settings/BudgetBanner";
import { RecentChangesCard } from "@/components/changes/RecentChangesCard";
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner";
import { ActionsSummaryCard } from "@/components/actions/ActionsSummaryCard";
import { TOP_ACTION_LIMIT } from "@/lib/action-filters";
import { ActionsSummaryCardSkeleton } from "@/components/actions/skeletons";

export default async function Page() {
  const queryClient = getQueryClient();
  const [portfolio] = await Promise.all([
    queryClient.fetchQuery(portfolioOptions),
    queryClient.prefetchQuery(recentChangesOptions()),
    queryClient.prefetchQuery(budgetOptions),
    queryClient.prefetchQuery(actionSummaryOptions),
    queryClient.prefetchQuery(
      actionsOptions({ status: ["OPEN"], limit: TOP_ACTION_LIMIT }),
    ),
  ]);

  if (portfolio.apps.length === 0) {
    return <FirstRun />;
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-wide flex flex-col gap-6">
        <Suspense fallback={null}>
          <OnboardingBanner />
        </Suspense>
        <Suspense fallback={null}>
          <BudgetBanner />
        </Suspense>

        <div className="flex items-center justify-between gap-4">
          <h1 className="text-display tracking-tight text-balance">Apps</h1>
          <ImportAppDialog>
            <Button>Import app</Button>
          </ImportAppDialog>
        </div>

        <Suspense fallback={<PortfolioTotalsSkeleton />}>
          <PortfolioSummary />
        </Suspense>

        <Suspense fallback={<ActionsSummaryCardSkeleton />}>
          <ActionsSummaryCard />
        </Suspense>

        <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
          <div className="lg:col-span-2">
            <Suspense fallback={<AppsDashboardSkeleton />}>
              <AppsDashboard />
            </Suspense>
          </div>
          <RecentChangesCard />
        </div>
      </div>
    </HydrationBoundary>
  );
}
