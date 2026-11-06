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
import { AppsRow } from "@/components/dashboard/AppsRow";
import { FirstRunGate } from "@/components/dashboard/FirstRunGate";
import { PortfolioPulse } from "@/components/dashboard/PortfolioPulse";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardLede } from "@/components/dashboard/DashboardLede";
import { DoNextCard } from "@/components/dashboard/DoNextCard";
import { AppsToolbar } from "@/components/dashboard/AppsToolbar";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
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
import { BudgetBanner } from "@/components/settings/BudgetBanner";
import { RecentChangesCard } from "@/components/changes/RecentChangesCard";
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner";
import { DASHBOARD_ACTION_LIMIT } from "@/lib/action-filters";
import { appViewParser } from "@/lib/search-params";
import { viewerIsOperator } from "@/lib/viewer";

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
  const [, operator] = await Promise.all([
    queryClient.fetchQuery(portfolioOptions),
    viewerIsOperator(),
  ]);
  if (operator) void queryClient.prefetchQuery(budgetOptions);

  const today = new Date().toISOString().slice(0, 10);
  const view = appViewParser.parseServerSide((await searchParams).view);

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

          <div className="grid gap-6 @5xl/dashboard:grid-cols-12 [&>*]:min-w-0">
            <div className="@5xl/dashboard:col-span-7">
              <Suspense fallback={<PortfolioMoversCardSkeleton />}>
                <PortfolioMoversCard />
              </Suspense>
            </div>
            <div className="@5xl/dashboard:col-span-5">
              <Suspense fallback={<DoNextCardSkeleton />}>
                <DoNextCard />
              </Suspense>
            </div>
          </div>

          <AppsRow
            apps={
              <DashboardSection
                id="apps"
                title="Apps"
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
            }
            changes={<RecentChangesCard today={today} />}
          />
        </div>
      </FirstRunGate>
    </HydrationBoundary>
  );
}
