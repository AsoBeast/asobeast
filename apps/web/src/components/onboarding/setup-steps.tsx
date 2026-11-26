"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import Link from "next/link";
import {
  SETUP_KEYWORD_TARGET,
  type CompetitorItem,
  type MarketSuggestionsResult,
  type Store,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { CountrySelect } from "@/components/CountrySelect";
import { AddCompetitorForm } from "@/components/competitors/AddCompetitorForm";
import { FOOTER_LINK } from "@/components/layout/panel-classes";
import { COUNTRY_OPTIONS, marketError } from "@/lib/countries";
import { formatCountryInLocale, formatListInLocale } from "@/lib/format";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { useAppLocale } from "@/lib/use-app-locale";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DiscoveredApps } from "./DiscoveredApps";
import { KeywordPicker } from "./KeywordPicker";
import { FirstDiscoveries } from "./FirstDiscoveries";
import {
  SelectedCountries,
  type MarketKeywordCount,
} from "./SelectedCountries";
import { activeKeywordCount, keywordsStepDescription } from "./setup-progress";
import { StepPanel, type StepProps } from "./StepPanel";
import { MarketCostTip, SuggestedMarkets } from "./SuggestedMarkets";

const COUNT_LINE = "numeric text-caption text-muted-foreground";

const competitorName = (
  competitor: CompetitorItem,
  t: MessageTranslator,
): string =>
  competitor.name ??
  competitor.latestSnapshot?.title ??
  t("competitors.unnamed");

function competitorsLine(
  competitors: CompetitorItem[] | null,
  error: boolean,
  t: MessageTranslator,
  locale: Locale,
): string {
  if (error) return t("competitors.countError");
  if (competitors === null) return t("competitors.countLoading");
  if (competitors.length === 0) return t("competitors.countNone");
  return t("competitors.countTracked", {
    count: competitors.length,
    names: formatListInLocale(
      competitors.map((competitor) => competitorName(competitor, t)),
      locale,
    ),
  });
}

export function CompetitorsStep({
  appId,
  competitors,
  error,
  collecting,
  ...step
}: StepProps & {
  appId: string;
  competitors: CompetitorItem[] | null;
  error: boolean;
  collecting: boolean;
}) {
  const t = useTranslations("setup");
  const locale = useAppLocale();
  return (
    <StepPanel
      step="competitors"
      description={t("steps.competitors.description")}
      footer={
        <>
          <span>{t("competitors.nextCheck")}</span>
          <Link href={`/apps/${appId}/competitors`} className={FOOTER_LINK}>
            {t("competitors.manage")}
          </Link>
        </>
      }
      {...step}
    >
      <Suspense fallback={<Skeleton className="h-9 w-full" />}>
        <AddCompetitorForm id={appId} submitVariant="outline" />
      </Suspense>
      <p className={COUNT_LINE}>
        {competitorsLine(competitors, error, t, locale)}
      </p>
      <DiscoveredApps appId={appId} collecting={collecting} />
    </StepPanel>
  );
}

function homeKeywordsLine(
  tracked: TrackedKeywordItem[] | null,
  error: boolean,
  homeMarket: string,
  { t, locale }: { t: MessageTranslator; locale: Locale },
): string {
  if (error) return t("keywords.countError");
  if (tracked === null) return t("keywords.countLoading");
  const active = activeKeywordCount(tracked);
  const market = formatCountryInLocale(homeMarket, locale);
  return active > SETUP_KEYWORD_TARGET
    ? t("keywords.countTracked", { count: active, country: market })
    : t("keywords.countTarget", {
        active,
        target: SETUP_KEYWORD_TARGET,
        country: market,
      });
}

export function KeywordsStep({
  appId,
  store,
  homeMarket,
  tracked,
  error,
  ...step
}: StepProps & {
  appId: string;
  store: Store;
  homeMarket: string;
  tracked: TrackedKeywordItem[] | null;
  error: boolean;
}) {
  const t = useTranslations("setup");
  const locale = useAppLocale();
  return (
    <StepPanel
      step="keywords"
      description={keywordsStepDescription(store, t)}
      footer={
        <>
          <span>{t("keywords.checkedDaily")}</span>
          <Link
            href={`/apps/${appId}/keywords?country=${homeMarket}`}
            className={FOOTER_LINK}
          >
            {t("keywords.review")}
          </Link>
        </>
      }
      {...step}
    >
      <p className={COUNT_LINE}>
        {homeKeywordsLine(tracked, error, homeMarket, { t, locale })}
      </p>
      <FirstDiscoveries id={appId} country={homeMarket} />
      {tracked ? (
        <KeywordPicker appId={appId} country={homeMarket} tracked={tracked} />
      ) : null}
    </StepPanel>
  );
}

const nextCountry = (markets: readonly string[]): string =>
  COUNTRY_OPTIONS.find((code) => !markets.includes(code)) ?? "";

export function CountriesStep({
  appId,
  store,
  homeMarket,
  counts,
  suggestions,
  onSelect,
  onReviewed,
  ...step
}: StepProps & {
  appId: string;
  store: Store;
  homeMarket: string;
  counts: MarketKeywordCount[];
  suggestions: MarketSuggestionsResult | null;
  onSelect: (market: string, selected: boolean) => void;
  onReviewed: () => void;
}) {
  const t = useTranslations("setup");
  const markets = counts.map((count) => count.market);
  const suggested =
    suggestions !== null && suggestions.suggestions.length > 0
      ? suggestions
      : null;
  const [picked, setPicked] = useState(() => nextCountry(markets));
  const value = markets.includes(picked) ? nextCountry(markets) : picked;
  const addable = value !== "" && marketError(store, value) === null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!addable) return;
    onSelect(value, true);
    setPicked(nextCountry([...markets, value]));
  };

  return (
    <StepPanel
      step="countries"
      description={t("steps.countries.description")}
      footer={
        <span className="flex items-center gap-1">
          <span>{t("countries.dailyCost")}</span>
          <MarketCostTip store={store} />
        </span>
      }
      {...step}
    >
      {suggested ? (
        <SuggestedMarkets
          appId={appId}
          result={suggested}
          selected={markets}
          onSelect={onSelect}
        />
      ) : null}
      <SelectedCountries
        appId={appId}
        homeMarket={homeMarket}
        counts={counts}
        onRemove={(market) => onSelect(market, false)}
      />
      <form onSubmit={submit} className="flex flex-col gap-1">
        <Label htmlFor="setup-country">
          {suggested ? t("countries.addAnother") : t("countries.add")}
        </Label>
        <div className="flex flex-wrap items-start gap-2">
          <CountrySelect
            id="setup-country"
            store={store}
            value={value}
            onChange={setPicked}
            ariaLabel={t("countries.countryToAdd")}
          />
          <Button type="submit" variant="outline" disabled={!addable}>
            <Plus />
            {t("countries.addAction")}
          </Button>
        </div>
      </form>
      {step.state === "open" ? (
        <Button variant="outline" className="w-fit" onClick={onReviewed}>
          {t("countries.reviewed")}
        </Button>
      ) : null}
    </StepPanel>
  );
}
