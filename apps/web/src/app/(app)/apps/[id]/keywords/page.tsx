import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { CollapsedSectionsProvider } from "@/components/layout/CollapsedSections";
import { KNOWN_SECTIONS } from "@/components/layout/known-sections";
import { KeywordsWorkspace } from "@/components/keywords/KeywordsWorkspace";
import { hasMarketReads, ownsKeywordFields } from "@/lib/app-localizations";
import {
  COLLAPSED_COOKIE_NAME,
  parseCollapsed,
} from "@/lib/collapsed-sections";
import { getQueryClient } from "@/lib/get-query-client";
import {
  appDetailOptions,
  keywordCountriesOptions,
  keywordDiscoveriesOptions,
  keywordFieldOptions,
  keywordsOptions,
  marketKeywordFieldsOptions,
} from "@/lib/queries";
import {
  combinationParsers,
  COMBINATION_URL_KEYS,
  countryParser,
  keywordsTabParser,
} from "@/lib/search-params";

type PageSearchParams = Record<string, string | string[] | undefined>;

function onDiscoveredTab(id: string, searchParams: PageSearchParams): string {
  const query = new URLSearchParams({ tab: "discovered" });
  for (const [key, value] of Object.entries(searchParams)) {
    for (const entry of [value ?? []].flat()) query.append(key, entry);
  }
  return `/apps/${encodeURIComponent(id)}/keywords?${query.toString()}`;
}

export default async function KeywordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const collapsed = parseCollapsed(
    (await cookies()).get(COLLAPSED_COOKIE_NAME)?.value,
    KNOWN_SECTIONS,
  );

  const queryClient = getQueryClient();
  const app = await queryClient.fetchQuery(appDetailOptions(id));
  const market = countryParser.parseServerSide(sp.country) || app.country;
  const isAppStore = app.store === "APP_STORE";
  const discoveries = !app.isCompetitor;
  const discovered =
    discoveries && keywordsTabParser.parseServerSide(sp.tab) === "discovered";
  const combinationsOpen = combinationParsers.open.parseServerSide(
    sp[COMBINATION_URL_KEYS.open],
  );
  if (discoveries && combinationsOpen && sp.tab === undefined) {
    redirect(onDiscoveredTab(id, sp));
  }

  await Promise.all([
    queryClient.prefetchQuery(keywordCountriesOptions(id)),
    queryClient.prefetchQuery(keywordsOptions(id, market)),
    isAppStore && combinationsOpen
      ? queryClient.prefetchQuery(keywordFieldOptions(id))
      : null,
    discovered
      ? queryClient.prefetchQuery(keywordDiscoveriesOptions(id, market))
      : null,
  ]);
  const keywordFields = ownsKeywordFields(app);
  if (keywordFields && hasMarketReads(app.country, market)) {
    void queryClient.prefetchQuery(marketKeywordFieldsOptions(id, market));
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-full">
        <CollapsedSectionsProvider
          initial={[...collapsed]}
          known={KNOWN_SECTIONS}
        >
          <KeywordsWorkspace
            id={id}
            homeCountry={app.country}
            store={app.store}
            keywordFields={keywordFields}
            discoveries={discoveries}
          />
        </CollapsedSectionsProvider>
      </div>
    </HydrationBoundary>
  );
}
