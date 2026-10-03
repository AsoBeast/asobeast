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
import { AppsToolbar } from "@/components/dashboard/AppsToolbar";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { PortfolioMoversCard } from "@/components/dashboard/PortfolioMoversCard";
import {
  OperatorPortfolioStatusLine,
  PortfolioStatusLine,
} from "@/components/dashboard/PortfolioStatusLine";
import {
  AppsDashboardSkeleton,
  PortfolioMoversCardSkeleton,
  PortfolioStatusLineSkeleton,
  PortfolioPulseSkeleton,
} from "@/components/dashboard/skeletons";
import { BudgetBanner } from "@/components/settings/BudgetBanner";
import { RecentChangesCard } from "@/components/changes/RecentChangesCard";
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner";
import { ActionsSummaryCard } from "@/components/actions/ActionsSummaryCard";
import { DASHBOARD_ACTION_LIMIT } from "@/lib/action-filters";
import { appViewParser } from "@/lib/search-params";
import { viewerIsOperator } from "@/lib/viewer";
import { ActionsSummaryCardSkeleton } from "@/components/actions/skeletons";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(recentChangesOptions());
  void queryClient.prefetchQuery(runStatusOptions);
  void queryClient.prefetchQuery(actionSummaryOptions);
  void queryClient.prefetchQuery(
    actionsOptions({ status: ["OPEN"], limit: DASHBOARD_ACTION_LIMIT }),
  );
  void queryClient.prefetchQuery(portfolioInsightsOptions);
  const [portfolio, operator] = await Promise.all([
    queryClient.fetchQuery(portfolioOptions),
    viewerIsOperator(),
  ]);
  if (operator) void queryClient.prefetchQuery(budgetOptions);

  if (portfolio.apps.length === 0) {
    return <FirstRun />;
  }

  const today = new Date().toISOString().slice(0, 10);
  const view = appViewParser.parseServerSide((await searchParams).view);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-wide @container/dashboard flex flex-col gap-6">
        <Suspense fallback={null}>
          <OnboardingBanner />
        </Suspense>
        {operator ? (
          <Suspense fallback={null}>
            <BudgetBanner />
          </Suspense>
        ) : null}

        <DashboardHeader>
          <Suspense fallback={<PortfolioStatusLineSkeleton />}>
            {operator ? (
              <OperatorPortfolioStatusLine />
            ) : (
              <PortfolioStatusLine />
            )}
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
          <div className="@5xl/dashboard:col-span-5">
            <Suspense fallback={<PortfolioMoversCardSkeleton />}>
              <PortfolioMoversCard />
            </Suspense>
          </div>
        </div>

        <div className="grid gap-6 @6xl/dashboard:grid-cols-12 [&>*]:min-w-0">
          <DashboardSection
            id="apps"
            title="Apps"
            className="@6xl/dashboard:col-span-8"
            toolbar={
              <Suspense fallback={null}>
                <AppsToolbar />
              </Suspense>
            }
          >
            <Suspense fallback={<AppsDashboardSkeleton view={view} />}>
              <AppsDashboard />
            </Suspense>
          </DashboardSection>
          <div className="@6xl/dashboard:col-span-4">
            <RecentChangesCard today={today} />
          </div>
        </div>
      </div>
    </HydrationBoundary>
  );
}
