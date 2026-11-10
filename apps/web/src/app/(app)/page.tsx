import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/get-query-client";
import {
  actionActivityOptions,
  actionsOptions,
  actionSummaryOptions,
  budgetOptions,
  portfolioHistoryOptions,
  portfolioInsightsOptions,
  portfolioOptions,
  recentChangesOptions,
  runStatusOptions,
} from "@/lib/queries";
import { AppsDashboard } from "@/components/dashboard/AppsDashboard";
import { FirstRunGate } from "@/components/dashboard/FirstRunGate";
import { PortfolioPulse } from "@/components/dashboard/PortfolioPulse";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardLede } from "@/components/dashboard/DashboardLede";
import { DoNextCard } from "@/components/dashboard/DoNextCard";
import { AlertsCard } from "@/components/dashboard/AlertsCard";
import { PortfolioMoversCard } from "@/components/dashboard/PortfolioMoversCard";
import {
  OperatorPortfolioStatusLine,
  PortfolioStatusLine,
} from "@/components/dashboard/PortfolioStatusLine";
import {
  AppsDashboardSkeleton,
  DashboardLedeSkeleton,
  DoNextCardSkeleton,
  PortfolioMoversCardSkeleton,
  PortfolioStatusLineSkeleton,
  PortfolioPulseSkeleton,
} from "@/components/dashboard/skeletons";
import {
  SPLIT_NARROW,
  SPLIT_ROW,
  SPLIT_WIDE,
} from "@/components/dashboard/layout-classes";
import { BudgetBanner } from "@/components/settings/BudgetBanner";
import { RecentChangesCard } from "@/components/changes/RecentChangesCard";
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner";
import { DASHBOARD_ACTION_LIMIT } from "@/lib/action-filters";
import {
  appViewParser,
  dashboardMetricParser,
  dashboardRangeParser,
} from "@/lib/search-params";
import { viewerIsOperator } from "@/lib/viewer";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(recentChangesOptions());
  void queryClient.prefetchQuery(runStatusOptions);
  void queryClient.prefetchQuery(actionSummaryOptions);
  void queryClient.prefetchQuery(
    actionsOptions({ status: ["OPEN"], limit: DASHBOARD_ACTION_LIMIT }),
  );
  void queryClient.prefetchQuery(portfolioInsightsOptions);
  const params = await searchParams;
  const range = dashboardRangeParser.parseServerSide(params.range);
  const metric = dashboardMetricParser.parseServerSide(params.metric);
  void queryClient.prefetchQuery(portfolioHistoryOptions(range));
  if (metric === "actions") {
    void queryClient.prefetchQuery(actionActivityOptions({ days: range }));
  }
  const [, operator] = await Promise.all([
    queryClient.fetchQuery(portfolioOptions),
    viewerIsOperator(),
  ]);
  if (operator) void queryClient.prefetchQuery(budgetOptions);

  const today = new Date().toISOString().slice(0, 10);
  const view = appViewParser.parseServerSide(params.view);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FirstRunGate>
        <div className="page-wide @container/dashboard flex flex-col gap-6">
          <Suspense fallback={null}>
            <OnboardingBanner />
          </Suspense>
          {operator ? (
            <Suspense fallback={null}>
              <BudgetBanner />
            </Suspense>
          ) : null}

          <DashboardHeader
            lede={
              <Suspense fallback={<DashboardLedeSkeleton />}>
                <DashboardLede />
              </Suspense>
            }
          >
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

          <div className={SPLIT_ROW}>
            <div className={SPLIT_WIDE}>
              <Suspense fallback={<PortfolioMoversCardSkeleton />}>
                <PortfolioMoversCard />
              </Suspense>
            </div>
            <div className={SPLIT_NARROW}>
              <Suspense fallback={<DoNextCardSkeleton />}>
                <DoNextCard />
              </Suspense>
            </div>
          </div>

          <Suspense fallback={<AppsDashboardSkeleton view={view} />}>
            <AppsDashboard />
          </Suspense>

          <div className={SPLIT_ROW}>
            <div className={SPLIT_WIDE}>
              <RecentChangesCard today={today} />
            </div>
            <div className={SPLIT_NARROW}>
              <AlertsCard today={today} />
            </div>
          </div>
        </div>
      </FirstRunGate>
    </HydrationBoundary>
  );
}
