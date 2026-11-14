import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { PlanSection } from "@/components/settings/PlanSection";
import { TeamCard } from "@/components/settings/TeamCard";
import { ChecklistSettingsCard } from "@/components/checklist/ChecklistSettingsCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsIndex } from "@/components/settings/SettingsIndex";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { BudgetCard } from "@/components/settings/BudgetCard";
import { DeliveryCard } from "@/components/settings/DeliveryCard";
import { EmailAlertsCard } from "@/components/settings/EmailAlertsCard";
import { WebhooksCard } from "@/components/settings/WebhooksCard";
import { WorkspaceDeletionCard } from "@/components/settings/WorkspaceDeletionCard";
import {
  BudgetCardSkeleton,
  DeliveryCardSkeleton,
  EmailAlertsCardSkeleton,
  WebhooksCardSkeleton,
} from "@/components/settings/skeletons";
import { pageReturnedFromCheckout } from "@/lib/checkout-return";
import { getQueryClient } from "@/lib/get-query-client";
import {
  accountPlanOptions,
  alertDeliveryOptions,
  alertsConfigOptions,
  budgetOptions,
  emailAlertsOptions,
  webhooksOptions,
} from "@/lib/queries";
import { viewerIsOperator } from "@/lib/viewer";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const returnedFromCheckout = pageReturnedFromCheckout(await searchParams);
  const queryClient = getQueryClient();
  const [operator] = await Promise.all([
    viewerIsOperator(),
    returnedFromCheckout
      ? undefined
      : queryClient.prefetchQuery(accountPlanOptions),
    queryClient.prefetchQuery(webhooksOptions),
    queryClient.prefetchQuery(emailAlertsOptions),
    queryClient.prefetchQuery(alertsConfigOptions),
    queryClient.prefetchQuery(alertDeliveryOptions),
    queryClient.prefetchQuery(budgetOptions),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="@container/settings">
        <div className="mx-auto grid w-full max-w-[59rem] grid-cols-1 gap-x-12 @[59rem]/settings:grid-cols-[11rem_minmax(0,1fr)]">
          <SettingsIndex
            operator={operator}
            className="hidden @[59rem]/settings:block"
          />
          <div className="page-reading flex flex-col gap-8">
            <PageHeader title="Settings" />

            <PlanSection />

            {operator ? (
              <SettingsSection
                id="daily-capacity"
                title="Capacity"
                headed={false}
              >
                <Suspense fallback={<BudgetCardSkeleton />}>
                  <BudgetCard />
                </Suspense>
              </SettingsSection>
            ) : null}

            <SettingsSection
              id="getting-started"
              title="Getting started"
              headed={false}
            >
              <ChecklistSettingsCard />
            </SettingsSection>

            <SettingsSection id="alerts" title="Alerts">
              <Suspense fallback={<DeliveryCardSkeleton />}>
                <DeliveryCard />
              </Suspense>
              <div id="webhooks" className="scroll-mt-20">
                <Suspense fallback={<WebhooksCardSkeleton />}>
                  <WebhooksCard />
                </Suspense>
              </div>
              <div id="email-alerts" className="scroll-mt-20">
                <Suspense fallback={<EmailAlertsCardSkeleton />}>
                  <EmailAlertsCard />
                </Suspense>
              </div>
            </SettingsSection>

            <SettingsSection id="team" title="Team" headed={false}>
              <TeamCard />
            </SettingsSection>

            <SettingsSection id="workspace" title="Workspace" headed={false}>
              <WorkspaceDeletionCard />
            </SettingsSection>
          </div>
        </div>
      </div>
    </HydrationBoundary>
  );
}
