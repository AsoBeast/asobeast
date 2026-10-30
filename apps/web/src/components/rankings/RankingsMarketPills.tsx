"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { MarketPills } from "@/components/layout/MarketPills";
import { keywordCountriesOptions } from "@/lib/queries";
import { countryParser } from "@/lib/search-params";

export function RankingsMarketPills({ id }: { id: string }) {
  const [country, setCountry] = useQueryState("country", countryParser);
  const { data: markets } = useSuspenseQuery(keywordCountriesOptions(id));

  return (
    <div className="print:hidden">
      <MarketPills
        markets={markets.map((entry) => ({
          country: entry.country,
          count: entry.keywordCount,
        }))}
        value={country || null}
        onChange={(next) => void setCountry(next)}
        ariaLabel="Report markets"
        allLabel="All markets"
      />
    </div>
  );
}
