import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ApiTokensCard } from "@/components/integrations/ApiTokensCard";
import { McpServerCard } from "@/components/integrations/McpServerCard";
import { GuideLink } from "@/components/integrations/GuideLink";
import { IntegrationsStatus } from "@/components/integrations/IntegrationsStatus";
import { PageHeader } from "@/components/layout/PageHeader";
import { StoreConnectionsCard } from "@/components/integrations/StoreConnectionsCard";
import { StoreConnectionsSkeleton } from "@/components/integrations/skeletons";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { getQueryClient } from "@/lib/get-query-client";
import { storeConnectionsOptions } from "@/lib/queries";
import {
  INTEGRATIONS_GUIDE,
  STORE_CONNECTIONS_SECTION_ID,
} from "@/lib/store-connection-copy";

export default async function IntegrationsPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(storeConnectionsOptions);
  const connections = queryClient.getQueryData(
    storeConnectionsOptions.queryKey,
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-reading flex flex-col gap-8">
        <PageHeader
          title="Integrations"
          lede={
            connections?.available === false ? undefined : (
              <Suspense fallback={null}>
                <IntegrationsStatus />
              </Suspense>
            )
          }
          meta={
            <GuideLink
              href={INTEGRATIONS_GUIDE}
              subject="store connections, API tokens and MCP"
            >
              Read the integrations overview
            </GuideLink>
          }
        />

        <SettingsSection
          id={STORE_CONNECTIONS_SECTION_ID}
          title="Store connections"
        >
          <Suspense fallback={<StoreConnectionsSkeleton />}>
            <StoreConnectionsCard />
          </Suspense>
        </SettingsSection>

        <SettingsSection id="api-and-mcp" title="API and MCP">
          <ApiTokensCard />
          <McpServerCard />
        </SettingsSection>
      </div>
    </HydrationBoundary>
  );
}
