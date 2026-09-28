"use client";

import { useQueryStates } from "nuqs";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SearchInput } from "@/components/data-table/SearchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { portfolioOptions } from "@/lib/queries";
import {
  appListParsers,
  appSortParser,
  type AppSort,
} from "@/lib/search-params";

const SEARCH_MIN_APPS = 6;

const SORT_LABELS: Record<AppSort, string> = {
  visibility: "Visibility",
  change: "7 day change",
  top10: "Keywords in top 10",
  rating: "Rating",
  actions: "Open actions",
  name: "Name",
  updated: "Last collected",
};

export function AppsToolbar() {
  const { data } = useSuspenseQuery(portfolioOptions);
  const [{ q, sort }, setList] = useQueryStates(appListParsers);

  return (
    <>
      {data.apps.length > SEARCH_MIN_APPS ? (
        <SearchInput
          label="Search apps"
          value={q}
          onSearch={(next, options) => void setList({ q: next }, options)}
        />
      ) : null}
      <Select
        value={sort}
        onValueChange={(next) =>
          void setList({ sort: appSortParser.parse(next), dir: null })
        }
      >
        <SelectTrigger size="sm" aria-label="Sort by">
          <SelectValue>{SORT_LABELS[sort]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
