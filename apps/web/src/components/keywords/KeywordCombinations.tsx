"use client";

import { Suspense, useMemo } from "react";
import { createTranslator, useTranslations } from "next-intl";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useQueryState, useQueryStates } from "nuqs";
import type { Store } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardAction,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import {
  PANEL_ACTION,
  SECTION_CHEVRON,
  SECTION_TOGGLE,
} from "@/components/layout/panel-classes";
import { formatCountryInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { buildCombinations } from "@/lib/keyword-combinations";
import {
  appDetailOptions,
  keywordFieldOptions,
  keywordsOptions,
} from "@/lib/queries";
import {
  COMBINATION_URL_KEYS,
  combinationParsers,
  countryParser,
} from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { CombinationsTable } from "./CombinationsTable";
import { KeywordCombinationsSkeleton } from "./skeletons";

const TITLE_ID = "keyword-combinations-title";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export function untrackedCombinationSentence(
  truncated: boolean,
  count: number,
  t: MessageTranslator = english,
): string {
  return t(
    truncated
      ? "combinations.atLeastUntracked"
      : "combinations.untrackedSentence",
    { count },
  );
}

const LISTING_FIELD_KEYS: Record<Store, string> = {
  APP_STORE: "appStore",
  GOOGLE_PLAY: "googlePlay",
};

function UntrackedCount({
  id,
  store,
  homeCountry,
}: {
  id: string;
  store: Store;
  homeCountry: string;
}) {
  const t = useTranslations("keywords");
  const { data: app } = useQuery(appDetailOptions(id));
  const { data: tracked } = useQuery(keywordsOptions(id, homeCountry));
  const { data: field } = useQuery({
    ...keywordFieldOptions(id),
    enabled: store === "APP_STORE",
  });
  const untracked = useMemo(() => {
    if (!app || !tracked || (store === "APP_STORE" && !field)) return null;
    const { combinations, truncated } = buildCombinations({
      listing: {
        store,
        snapshot: app.latestSnapshot,
        keywordField: field?.tracked.map((keyword) => keyword.text) ?? [],
      },
      tracked,
      market: homeCountry,
    });
    const count = combinations.filter(
      ({ status }) => status === "untracked",
    ).length;
    return { count, truncated };
  }, [app, tracked, field, store, homeCountry]);
  if (untracked === null) return null;
  return (
    <span className="numeric">
      {untrackedCombinationSentence(untracked.truncated, untracked.count, t)}
    </span>
  );
}

export function KeywordCombinations({
  id,
  store,
  homeCountry,
  market,
  countUntracked,
}: {
  id: string;
  store: Store;
  homeCountry: string;
  market: string;
  countUntracked: boolean;
}) {
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  const [params, setParams] = useQueryStates(combinationParsers, {
    urlKeys: COMBINATION_URL_KEYS,
  });
  const [, setCountry] = useQueryState("country", countryParser);
  const home = formatCountryInLocale(homeCountry, locale);

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2 id={TITLE_ID}>
            <button
              type="button"
              aria-expanded={params.open}
              onClick={() => void setParams({ open: !params.open })}
              className={SECTION_TOGGLE}
            >
              {t("combinations.title")}
              <ChevronDown
                aria-hidden
                className={cn(SECTION_CHEVRON, !params.open && "-rotate-90")}
              />
            </button>
          </h2>
        </CardTitle>
        <CardAction className={PANEL_ACTION}>
          <InfoTip
            label={t("combinations.about")}
            title={t("combinations.title")}
            summary={t("combinations.summary")}
          />
        </CardAction>
      </CardHeader>
      {params.open ? (
        <CardContent
          role="region"
          aria-labelledby={TITLE_ID}
          className="flex flex-col gap-4"
        >
          <p className="text-body text-muted-foreground">
            {countUntracked && market === homeCountry ? (
              <UntrackedCount id={id} store={store} homeCountry={homeCountry} />
            ) : null}
            <span>
              {t("combinations.description", {
                fields: t(
                  `combinations.listingFields.${LISTING_FIELD_KEYS[store]}`,
                ),
              })}
            </span>
          </p>
          {market === homeCountry ? (
            <Suspense fallback={<KeywordCombinationsSkeleton />}>
              <CombinationsTable
                id={id}
                store={store}
                homeCountry={homeCountry}
                params={params}
                setParams={setParams}
              />
            </Suspense>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-body text-muted-foreground">
                {t("combinations.homeMarket", { country: home })}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void setCountry(null)}
              >
                {t("combinations.switchTo", { country: home })}
              </Button>
            </div>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
