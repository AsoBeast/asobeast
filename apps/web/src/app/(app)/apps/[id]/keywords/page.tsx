import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { KeywordsWorkspace } from "@/components/keywords/KeywordsWorkspace";
import { getQueryClient } from "@/lib/get-query-client";
import {
  appDetailOptions,
  keywordCountriesOptions,
  keywordFieldOptions,
  keywordFieldsOptions,
  keywordsOptions,
} from "@/lib/queries";
import { fieldLocalization, keywordFieldQuery } from "@/lib/keyword-field";
import { countryParser, fieldLocaleParser } from "@/lib/search-params";

export default async function KeywordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    country?: string | string[];
    fieldLocale?: string | string[];
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const queryClient = getQueryClient();
  const app = await queryClient.fetchQuery(appDetailOptions(id));
  const market = countryParser.parseServerSide(sp.country) || app.country;
  const fieldLocale = fieldLocaleParser.parseServerSide(sp.fieldLocale);

  await Promise.all([
    queryClient.prefetchQuery(keywordCountriesOptions(id)),
    queryClient.prefetchQuery(keywordsOptions(id, market)),
    ...(app.store === "APP_STORE" &&
    fieldLocalization(app.country, market, fieldLocale) !== undefined
      ? [
          queryClient.prefetchQuery(
            keywordFieldOptions(
              id,
              keywordFieldQuery(app.country, market, fieldLocale),
            ),
          ),
          queryClient.prefetchQuery(keywordFieldsOptions(id)),
        ]
      : []),
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
