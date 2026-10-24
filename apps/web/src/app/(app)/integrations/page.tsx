import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ApiTokensCard } from "@/components/integrations/ApiTokensCard";
import { McpServerCard } from "@/components/integrations/McpServerCard";
import { StoreConnectionsCard } from "@/components/integrations/StoreConnectionsCard";
import { StoreConnectionsSkeleton } from "@/components/integrations/skeletons";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { getQueryClient } from "@/lib/get-query-client";
import { storeConnectionsOptions } from "@/lib/queries";
import { STORE_CONNECTIONS_SECTION_ID } from "@/lib/store-connection-copy";

export default async function IntegrationsPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(storeConnectionsOptions);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-reading flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-display tracking-tight text-balance">
            Integrations
          </h1>
          <p className="text-body text-muted-foreground">
            Your store consoles, personal API tokens and the MCP server.
          </p>
        </div>

        <SettingsSection
          id={STORE_CONNECTIONS_SECTION_ID}
          title="Store connections"
          description="Connect App Store Connect or the Google Play Console so store listing visits, downloads and conversion appear beside your rankings."
        >
          <Suspense fallback={<StoreConnectionsSkeleton />}>
            <StoreConnectionsCard />
          </Suspense>
        </SettingsSection>

        <SettingsSection
          id="api-and-mcp"
          title="API and MCP"
          description="Personal tokens and the MCP server for your editor or agent."
        >
          <ApiTokensCard />
          <McpServerCard />
        </SettingsSection>
      </div>
    </HydrationBoundary>
  );
}
