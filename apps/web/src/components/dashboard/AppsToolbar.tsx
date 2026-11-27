"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
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
import { formatNumberInLocale, storeLabel } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
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

const SORT_OPTIONS = [
  "visibility",
  "change",
  "top10",
  "rating",
  "actions",
  "name",
  "updated",
] as const satisfies readonly AppSort[];

export function AppsToolbar({ columns }: { columns: ReactNode }) {
  const t = useTranslations("dashboard");
  const locale = useAppLocale();
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
          <TabsList aria-label={t("apps.store")}>
            <TabsOption value={EVERY_STORE}>
              <span>{t("apps.all")}</span>
              <span className="numeric text-muted-foreground">
                {formatNumberInLocale(data.apps.length, locale)}
              </span>
            </TabsOption>
            {counts.map(({ store: each, apps }) => (
              <TabsOption key={each} value={each}>
                <span>{storeLabel(each)}</span>
                <span className="numeric text-muted-foreground">
                  {formatNumberInLocale(apps, locale)}
                </span>
              </TabsOption>
            ))}
          </TabsList>
        </Tabs>
      ) : null}
      <VisibilityHelp />
      {data.apps.length > SEARCH_MIN_APPS || q !== "" ? (
        <SearchInput
          label={t("apps.search")}
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
          <SelectTrigger size="sm" aria-label={t("apps.sortBy")}>
            <SelectValue>{t(`sort.${sort}`)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`sort.${value}`)}
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
          <TabsOption value="table" aria-label={t("apps.tableView")}>
            <Rows3 aria-hidden />
          </TabsOption>
          <TabsOption value="cards" aria-label={t("apps.cardsView")}>
            <LayoutGrid aria-hidden />
          </TabsOption>
        </TabsList>
      </Tabs>
    </>
  );
}
