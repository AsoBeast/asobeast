"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  CHANGE_IMPACT_WINDOWS,
  type ChangeImpactItem,
  type Store,
} from "@asobeast/shared";
import {
  LIST_HEAD,
  PANEL_BLEED,
  PANEL_HEADER,
} from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { VisibilityHelp } from "@/components/visibility/VisibilityHelp";
import { formatCountryInLocale, formatDateInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { changeImpactOptions, keywordCountriesOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { impactAnchor } from "./change-effects";
import { changedFieldsText } from "./change-fields";
import { impactScopeLine, windowTitle } from "./change-impact-copy";
import {
  ChangeImpactWindowTile,
  FunnelOnlyCell,
} from "./ChangeImpactWindowTile";
import { ChangeImpactSkeleton } from "./skeletons";
import { useChangeWindow, useImpactCountry } from "./use-change-view";

const COLUMNS = "@3xl/impact:grid-cols-[minmax(11rem,0.9fr)_3fr]";
const WINDOWS =
  "grid grid-cols-1 pb-2 @3xl/impact:grid-cols-3 @3xl/impact:pb-0";

interface ImpactScope {
  id: string;
  store: Store;
  days: number;
  market: string;
}

function ColumnHead() {
  const t = useTranslations("changes");
  return (
    <div
      aria-hidden
      className={cn(
        "hidden h-9 items-center border-b border-border @3xl/impact:grid",
        COLUMNS,
        LIST_HEAD,
      )}
    >
      <span className="px-4">{t("impact.change")}</span>
      <span className="grid grid-cols-3">
        {CHANGE_IMPACT_WINDOWS.map((days) => (
          <span key={days} className="px-4">
            {windowTitle(days, t)}
          </span>
        ))}
      </span>
    </div>
  );
}

function ChangeImpactRow({
  item,
  store,
}: {
  item: ChangeImpactItem;
  store: Store;
}) {
  const t = useTranslations("changes");
  const locale = useAppLocale();
  const anchored = item.baselineDate !== null;
  const windows = anchored
    ? item.windows
    : item.windows.filter((impact) => impact.funnel);

  return (
    <li
      className={cn(
        "grid grid-cols-1 border-t border-border first:border-t-0 @3xl/impact:border-border-subtle",
        COLUMNS,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5 px-4 pt-3 @3xl/impact:pb-3">
        <h3
          id={impactAnchor(item.changedOn)}
          tabIndex={-1}
          className="scroll-mt-16 rounded-sm text-dense font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {formatDateInLocale(item.changedOn, locale)}
        </h3>
        <p className="text-dense text-muted-foreground">
          {changedFieldsText(item.fields, t).map((label, index) => (
            <span key={label}>
              {index > 0 ? <span>{", "}</span> : null}
              <span>{label}</span>
            </span>
          ))}
        </p>
        <p className="mt-1 text-caption text-faint-foreground">
          {anchored
            ? t("impact.comparedWith", {
                date: formatDateInLocale(item.baselineDate, locale),
              })
            : t("impact.noBaseline")}
        </p>
      </div>
      {windows.length > 0 ? (
        <ul className={WINDOWS}>
          {windows.map((impact) =>
            anchored ? (
              <ChangeImpactWindowTile
                key={impact.days}
                impact={impact}
                store={store}
              />
            ) : (
              <FunnelOnlyCell key={impact.days} impact={impact} store={store} />
            ),
          )}
        </ul>
      ) : null}
    </li>
  );
}

function ChangeImpactList({ id, store, days, market }: ImpactScope) {
  const t = useTranslations("changes");
  const { data } = useSuspenseQuery(changeImpactOptions(id, days, market));

  if (data.items.length === 0) {
    return (
      <CardContent>
        <EmptyState
          title={t("impact.emptyTitle", { days })}
          body={t("impact.emptyBody")}
        />
      </CardContent>
    );
  }

  return (
    <>
      <CardContent className={cn(PANEL_BLEED, "@container/impact")}>
        <ColumnHead />
        <ul>
          {data.items.map((item) => (
            <ChangeImpactRow key={item.changedOn} item={item} store={store} />
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <span>
          {t("impact.footer", {
            scope: impactScopeLine(
              {
                days,
                totalChanges: data.totalChanges,
                shown: data.items.length,
              },
              t,
            ),
            market: market.toUpperCase(),
          })}
        </span>
      </CardFooter>
    </>
  );
}

function ChangeImpactBody({ id, store, days, market }: ImpactScope) {
  const t = useTranslations("changes");
  const locale = useAppLocale();
  const { data: markets } = useSuspenseQuery(keywordCountriesOptions(id));
  const tracked =
    markets.find((entry) => entry.country === market)?.keywordCount ?? 0;

  if (tracked === 0) {
    return (
      <CardContent>
        <EmptyState
          title={t("impact.noKeywordsTitle", {
            market: formatCountryInLocale(market, locale),
          })}
          body={t("impact.noKeywordsBody")}
        />
      </CardContent>
    );
  }
  return (
    <Suspense fallback={<ChangeImpactSkeleton />}>
      <ChangeImpactList id={id} store={store} days={days} market={market} />
    </Suspense>
  );
}

export function ChangeImpactCard({
  id,
  store,
  homeCountry,
}: {
  id: string;
  store: Store;
  homeCountry: string;
}) {
  const t = useTranslations("changes");
  const days = useChangeWindow();
  const market = useImpactCountry(homeCountry);

  return (
    <Card role="region" aria-label={t("impact.region")}>
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>{t("impact.title")}</h2>
        </CardTitle>
        <CardAction>
          <VisibilityHelp note={t("impact.help")} />
        </CardAction>
      </CardHeader>
      <Suspense fallback={<ChangeImpactSkeleton />}>
        <ChangeImpactBody id={id} store={store} days={days} market={market} />
      </Suspense>
    </Card>
  );
}
