import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { LocalizationSwitcher } from "@/components/app-detail/LocalizationSwitcher";
import { MarketSwitcher } from "@/components/app-detail/MarketSwitcher";
import { MarketSwitcherSkeleton } from "@/components/app-detail/skeletons";
import { MetadataAuditView } from "@/components/metadata/MetadataAuditView";
import { MetadataAuditSkeleton } from "@/components/metadata/skeletons";
import { ApiError, getMetadataAssistantStatus } from "@/lib/api";
import { getQueryClient } from "@/lib/get-query-client";
import { queryMarket, resolveLocalization, resolveMarket } from "@/lib/market";
import {
  appDetailOptions,
  keywordCountriesOptions,
  listingMarketsOptions,
  metadataAuditOptions,
  screenshotsOptions,
} from "@/lib/queries";
import { localizationParser, marketParser } from "@/lib/search-params";

export default async function MetadataPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    market?: string | string[];
    localization?: string | string[];
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const requested = marketParser.parseServerSide(query.market);
  const queryClient = getQueryClient();
  const [app, markets] = await Promise.all([
    queryClient.fetchQuery(appDetailOptions(id)),
    queryClient.fetchQuery(listingMarketsOptions(id)).catch(() => []),
  ]);
  const market = resolveMarket(requested, markets, app.country);
  const localization =
    resolveLocalization(
      localizationParser.parseServerSide(query.localization),
      markets,
      market,
    ) ?? undefined;

  const result = await queryClient
    .fetchQuery(
      metadataAuditOptions(id, queryMarket(market, app.country), localization),
    )
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
  if (result.store === "APP_STORE") {
    void queryClient.prefetchQuery(
      screenshotsOptions(id, queryMarket(market, app.country), localization),
    );
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
          <div className="flex flex-wrap items-center gap-4">
            <MarketSwitcher id={id} />
            <LocalizationSwitcher id={id} />
          </div>
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
