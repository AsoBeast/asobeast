import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ChangeImpactCard } from "@/components/changes/ChangeImpactCard";
import { ChangeTimeline } from "@/components/changes/ChangeTimeline";
import { getQueryClient } from "@/lib/get-query-client";
import {
  appDetailOptions,
  changeImpactOptions,
  changesOptions,
  keywordCountriesOptions,
} from "@/lib/queries";
import { changeDaysParser, countryParser } from "@/lib/search-params";

export default async function ChangesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    days?: string | string[];
    country?: string | string[];
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const days = changeDaysParser.parseServerSide(sp.days);

  const queryClient = getQueryClient();
  const app = await queryClient.fetchQuery(appDetailOptions(id));
  const market = countryParser.parseServerSide(sp.country) || app.country;
  await Promise.all([
    queryClient.prefetchQuery(changesOptions(id, days)),
    queryClient.prefetchQuery(keywordCountriesOptions(id)),
    queryClient.prefetchQuery(changeImpactOptions(id, days, market)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-wide flex flex-col gap-6">
        <ChangeImpactCard id={id} homeCountry={app.country} />
        <ChangeTimeline id={id} />
      </div>
    </HydrationBoundary>
  );
}
