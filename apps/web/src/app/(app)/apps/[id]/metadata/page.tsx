import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { LocalizationSwitcher } from "@/components/app-detail/LocalizationSwitcher";
import { MarketSwitcher } from "@/components/app-detail/MarketSwitcher";
import { MarketSwitcherSkeleton } from "@/components/app-detail/skeletons";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetadataAuditView } from "@/components/metadata/MetadataAuditView";
import { MetadataStatusLine } from "@/components/metadata/MetadataStatusLine";
import {
  MetadataAuditSkeleton,
  MetadataStatusSkeleton,
} from "@/components/metadata/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { ApiError, getMetadataAssistantStatus } from "@/lib/api";
import { ownsKeywordFields } from "@/lib/app-localizations";
import { getQueryClient } from "@/lib/get-query-client";
import { queryMarket, resolveLocalization, resolveMarket } from "@/lib/market";
import {
  appDetailOptions,
  appLocalizationsOptions,
  keywordCountriesOptions,
  listingMarketsOptions,
  marketSuggestionsOptions,
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
      <EmptyState
        title="No metadata audit yet"
        body="The audit appears once a snapshot of this listing is stored."
        className="page-wide"
      />
    );
  }
  const isAppStore = result.store === "APP_STORE";
  const keywordFields = ownsKeywordFields(app);
  if (isAppStore) {
    void queryClient.prefetchQuery(
      screenshotsOptions(id, queryMarket(market, app.country), localization),
    );
  }
  const [keywordMarkets, assistant] = await Promise.all([
    isAppStore
      ? queryClient.fetchQuery(keywordCountriesOptions(id)).catch(() => null)
      : null,
    getMetadataAssistantStatus().catch(() => null),
    keywordFields
      ? queryClient.prefetchQuery(appLocalizationsOptions(id))
      : null,
    keywordFields
      ? queryClient.prefetchQuery(marketSuggestionsOptions(id))
      : null,
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-wide @container/metadata flex flex-col gap-6">
        <PageHeader title="Metadata" titleHidden>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <Suspense fallback={<MetadataStatusSkeleton />}>
              <MetadataStatusLine id={id} keywordFields={keywordFields} />
            </Suspense>
            <Suspense fallback={<MarketSwitcherSkeleton />}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <MarketSwitcher id={id} />
                <LocalizationSwitcher id={id} />
              </div>
            </Suspense>
          </div>
        </PageHeader>
        <Suspense fallback={<MetadataAuditSkeleton />}>
          <MetadataAuditView
            id={id}
            canDraft={assistant?.configured === true}
            hasLocalizations={keywordMarkets !== null}
            keywordFields={keywordFields}
          />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
}
