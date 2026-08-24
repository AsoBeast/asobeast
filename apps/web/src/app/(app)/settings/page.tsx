import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ApiTokensCard } from "@/components/settings/ApiTokensCard";
import { McpServerCard } from "@/components/settings/McpServerCard";
import { PlanSection } from "@/components/settings/PlanSection";
import { TeamCard } from "@/components/settings/TeamCard";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { BudgetCard } from "@/components/settings/BudgetCard";
import { DeliveryCard } from "@/components/settings/DeliveryCard";
import { EmailAlertsCard } from "@/components/settings/EmailAlertsCard";
import { WebhooksCard } from "@/components/settings/WebhooksCard";
import {
  BudgetCardSkeleton,
  DeliveryCardSkeleton,
  EmailAlertsCardSkeleton,
  WebhooksCardSkeleton,
} from "@/components/settings/skeletons";
import { getQueryClient } from "@/lib/get-query-client";
import {
  alertDeliveryOptions,
  alertsConfigOptions,
  budgetOptions,
  emailAlertsOptions,
  webhooksOptions,
} from "@/lib/queries";

export default async function SettingsPage() {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(webhooksOptions),
    queryClient.prefetchQuery(emailAlertsOptions),
    queryClient.prefetchQuery(alertsConfigOptions),
    queryClient.prefetchQuery(alertDeliveryOptions),
    queryClient.prefetchQuery(budgetOptions),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-reading flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-display tracking-tight text-balance">Settings</h1>
          <p className="text-body text-muted-foreground">
            Configure alert channels and review your daily request budget.
          </p>
        </div>

        <PlanSection />

        <SettingsSection
          id="daily-capacity"
          title="Capacity"
          description="How much of your daily store request budget the pipeline uses. It governs how many markets you can track."
        >
          <Suspense fallback={<BudgetCardSkeleton />}>
            <BudgetCard />
          </Suspense>
        </SettingsSection>

        <SettingsSection
          id="alerts"
          title="Alerts"
          description="When asobeast tells you something changed, and where it sends that."
        >
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

        <SettingsSection
          id="team"
          title="Team"
          description="Who can sign in to this workspace, and how to invite someone else."
        >
          <TeamCard />
        </SettingsSection>

        <SettingsSection
          id="integrations"
          title="Integrations"
          description="Personal tokens and the read-only MCP server for your editor or agent."
        >
          <ApiTokensCard />
          <McpServerCard />
        </SettingsSection>
      </div>
    </HydrationBoundary>
  );
}
