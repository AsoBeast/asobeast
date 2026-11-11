"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useQueryState } from "nuqs";
import type { Store } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCountry } from "@/lib/format";
import { keywordCountriesOptions } from "@/lib/queries";
import { countryParser } from "@/lib/search-params";
import { AddKeywordsDialog } from "./AddKeywordsDialog";
import { marketChoices } from "./market-choices";

const COUNT = "numeric text-faint-foreground";

export function KeywordMarketSelect({
  id,
  store,
  market,
}: {
  id: string;
  store: Store;
  market: string;
}) {
  const [, setCountry] = useQueryState("country", countryParser);
  const { data: markets } = useSuspenseQuery(keywordCountriesOptions(id));
  const choices = marketChoices(markets, market);
  const current = choices.find((choice) => choice.country === market);

  return (
    <div className="flex items-center gap-2">
      <Select value={market} onValueChange={(next) => void setCountry(next)}>
        <SelectTrigger aria-label="Keyword markets">
          <SelectValue>
            <span className="font-medium">{formatCountry(market)}</span>
            <span className={COUNT}>{current?.count ?? 0}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => (
            <SelectItem key={choice.country} value={choice.country}>
              <span>{formatCountry(choice.country)}</span>
              <span className={COUNT}>{choice.count}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <AddKeywordsDialog appId={id} store={store} country={market}>
        <Button variant="outline" size="icon" aria-label="Add a market">
          <Plus />
        </Button>
      </AddKeywordsDialog>
    </div>
  );
}
