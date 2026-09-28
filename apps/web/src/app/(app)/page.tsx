import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/get-query-client";
import {
  actionsOptions,
  actionSummaryOptions,
  budgetOptions,
  portfolioInsightsOptions,
  portfolioOptions,
  recentChangesOptions,
  runStatusOptions,
} from "@/lib/queries";
import { AppsDashboard } from "@/components/dashboard/AppsDashboard";
import { FirstRun } from "@/components/apps/FirstRun";
import { PortfolioPulse } from "@/components/dashboard/PortfolioPulse";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { PortfolioStatusLine } from "@/components/dashboard/PortfolioStatusLine";
import {
  AppsDashboardSkeleton,
  PortfolioStatusLineSkeleton,
  PortfolioPulseSkeleton,
} from "@/components/dashboard/skeletons";
import { BudgetBanner } from "@/components/settings/BudgetBanner";
import { RecentChangesCard } from "@/components/changes/RecentChangesCard";
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner";
import { ActionsSummaryCard } from "@/components/actions/ActionsSummaryCard";
import { TOP_ACTION_LIMIT } from "@/lib/action-filters";
import { ActionsSummaryCardSkeleton } from "@/components/actions/skeletons";

export default async function Page() {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(recentChangesOptions());
  void queryClient.prefetchQuery(budgetOptions);
  void queryClient.prefetchQuery(runStatusOptions);
  void queryClient.prefetchQuery(actionSummaryOptions);
  void queryClient.prefetchQuery(
    actionsOptions({ status: ["OPEN"], limit: TOP_ACTION_LIMIT }),
  );
  void queryClient.prefetchQuery(portfolioInsightsOptions);
  const portfolio = await queryClient.fetchQuery(portfolioOptions);

  if (portfolio.apps.length === 0) {
    return <FirstRun />;
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-wide @container/dashboard flex flex-col gap-6">
        <Suspense fallback={null}>
          <OnboardingBanner />
        </Suspense>
        <Suspense fallback={null}>
          <BudgetBanner />
        </Suspense>

        <DashboardHeader>
          <Suspense fallback={<PortfolioStatusLineSkeleton />}>
            <PortfolioStatusLine />
          </Suspense>
        </DashboardHeader>

        <Suspense fallback={<PortfolioPulseSkeleton />}>
          <PortfolioPulse />
        </Suspense>

        <div className="grid gap-6 @5xl/dashboard:grid-cols-12 [&>*]:min-w-0">
          <div className="@5xl/dashboard:col-span-7">
            <Suspense fallback={<ActionsSummaryCardSkeleton />}>
              <ActionsSummaryCard />
            </Suspense>
          </div>
        </div>

        <div className="grid gap-6 @6xl/dashboard:grid-cols-12 [&>*]:min-w-0">
          <DashboardSection
            id="apps"
            title="Apps"
            className="@6xl/dashboard:col-span-8"
          >
            <Suspense fallback={<AppsDashboardSkeleton />}>
              <AppsDashboard />
            </Suspense>
          </DashboardSection>
          <div className="@6xl/dashboard:col-span-4">
            <RecentChangesCard />
          </div>
        </div>
      </div>
    </HydrationBoundary>
  );
}
