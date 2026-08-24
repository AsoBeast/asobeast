import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { KeywordsWorkspace } from "@/components/keywords/KeywordsWorkspace";
import { getQueryClient } from "@/lib/get-query-client";
import {
  appDetailOptions,
  keywordCountriesOptions,
  keywordsOptions,
} from "@/lib/queries";
import { countryParser, sortParser } from "@/lib/search-params";

export default async function KeywordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    sort?: string | string[];
    country?: string | string[];
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const sort = sortParser.parseServerSide(sp.sort);

  const queryClient = getQueryClient();
  const app = await queryClient.fetchQuery(appDetailOptions(id));
  const market = countryParser.parseServerSide(sp.country) || app.country;

  await Promise.all([
    queryClient.prefetchQuery(keywordCountriesOptions(id)),
    queryClient.prefetchQuery(keywordsOptions(id, sort, market)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-full">
        <KeywordsWorkspace
          id={id}
          homeCountry={app.country}
          store={app.store}
        />
      </div>
    </HydrationBoundary>
  );
}
