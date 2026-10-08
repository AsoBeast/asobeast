import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { MarketSwitcher } from "@/components/app-detail/MarketSwitcher";
import { MarketSwitcherSkeleton } from "@/components/app-detail/skeletons";
import { MetadataAuditView } from "@/components/metadata/MetadataAuditView";
import { MetadataAuditSkeleton } from "@/components/metadata/skeletons";
import { ApiError, getMetadataAssistantStatus } from "@/lib/api";
import { getQueryClient } from "@/lib/get-query-client";
import { queryMarket, resolveMarket } from "@/lib/market";
import {
  appDetailOptions,
  keywordCountriesOptions,
  listingMarketsOptions,
  metadataAuditOptions,
  screenshotsOptions,
} from "@/lib/queries";
import { marketParser } from "@/lib/search-params";

export default async function MetadataPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ market?: string | string[] }>;
}) {
  const { id } = await params;
  const requested = marketParser.parseServerSide((await searchParams).market);
  const queryClient = getQueryClient();
  const app = await queryClient.fetchQuery(appDetailOptions(id));
  const markets = await queryClient
    .fetchQuery(listingMarketsOptions(id))
    .catch(() => []);
  const market = resolveMarket(requested, markets, app.country);

  const result = await queryClient
    .fetchQuery(metadataAuditOptions(id, queryMarket(market, app.country)))
    .catch((err) => {
      if (err instanceof ApiError && err.envelope.statusCode === 404)
        notFound();
      return null;
    });
  if (!result) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Metadata audit is not available for this app yet.
      </div>
    );
  }
  if (result.store === "APP_STORE" && market === app.country) {
    void queryClient.prefetchQuery(screenshotsOptions(id));
  }
  const [keywordMarkets, assistant] = await Promise.all([
    result.store === "APP_STORE"
      ? queryClient.fetchQuery(keywordCountriesOptions(id)).catch(() => null)
      : null,
    getMetadataAssistantStatus().catch(() => null),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-wide @container/metadata flex flex-col gap-8">
        <Suspense fallback={<MarketSwitcherSkeleton />}>
          <MarketSwitcher id={id} />
        </Suspense>
        <Suspense fallback={<MetadataAuditSkeleton />}>
          <MetadataAuditView
            id={id}
            canDraft={assistant?.configured === true}
            hasLocalizations={keywordMarkets !== null}
          />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
}
