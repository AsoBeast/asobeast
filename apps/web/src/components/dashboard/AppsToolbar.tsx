"use client";

import type { ReactNode } from "react";
import { useQueryStates } from "nuqs";
import { useSuspenseQuery } from "@tanstack/react-query";
import { LayoutGrid, Rows3 } from "lucide-react";
import { STORES } from "@asobeast/shared";
import { SearchInput } from "@/components/data-table/SearchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { VisibilityHelp } from "@/components/visibility/VisibilityHelp";
import { formatNumber, storeLabel } from "@/lib/format";
import { portfolioOptions } from "@/lib/queries";
import {
  appListParsers,
  appSortParser,
  appStoreParser,
  appViewParser,
  type AppSort,
} from "@/lib/search-params";

const SEARCH_MIN_APPS = 6;

const EVERY_STORE = "all";

const SORT_LABELS: Record<AppSort, string> = {
  visibility: "Visibility",
  change: "7 day change",
  top10: "Keywords in top 10",
  rating: "Rating",
  actions: "Open actions",
  name: "Name",
  updated: "Last collected",
};

export function AppsToolbar({ columns }: { columns: ReactNode }) {
  const { data } = useSuspenseQuery(portfolioOptions);
  const [{ q, sort, view, store }, setList] = useQueryStates(appListParsers);
  const counts = STORES.map((each) => ({
    store: each,
    apps: data.apps.filter((app) => app.store === each).length,
  })).filter(({ apps }) => apps > 0);

  return (
    <>
      {counts.length > 1 ? (
        <Tabs
          value={store ?? EVERY_STORE}
          onValueChange={(next) =>
            void setList({ store: appStoreParser.parse(next) })
          }
        >
          <TabsList aria-label="Store">
            <TabsOption value={EVERY_STORE}>
              <span>All</span>
              <span className="numeric text-muted-foreground">
                {formatNumber(data.apps.length)}
              </span>
            </TabsOption>
            {counts.map(({ store: each, apps }) => (
              <TabsOption key={each} value={each}>
                <span>{storeLabel(each)}</span>
                <span className="numeric text-muted-foreground">
                  {formatNumber(apps)}
                </span>
              </TabsOption>
            ))}
          </TabsList>
        </Tabs>
      ) : null}
      <VisibilityHelp />
      {data.apps.length > SEARCH_MIN_APPS || q !== "" ? (
        <SearchInput
          label="Search apps"
          value={q}
          onSearch={(next, options) => void setList({ q: next }, options)}
        />
      ) : null}
      {view === "cards" ? (
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
      ) : null}
      {columns}
      <Tabs
        value={view}
        onValueChange={(next) =>
          void setList({ view: appViewParser.parse(next) })
        }
      >
        <TabsList>
          <TabsOption value="table" aria-label="Table">
            <Rows3 aria-hidden />
          </TabsOption>
          <TabsOption value="cards" aria-label="Cards">
            <LayoutGrid aria-hidden />
          </TabsOption>
        </TabsList>
      </Tabs>
    </>
  );
}
