"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ListingMarket } from "@asobeast/shared";
import { useMarket } from "@/components/app-detail/use-market";
import { CollapsedSectionsProvider } from "@/components/layout/CollapsedSections";
import { CollapsibleCard } from "@/components/layout/CollapsibleCard";
import { KNOWN_SECTIONS } from "@/components/layout/known-sections";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { GradedNumber } from "@/components/ui/graded";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumberInLocale, formatRatingInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { grade } from "@/lib/grade";
import { offersMarkets } from "@/lib/market";
import { marketRatingRows, ratingTotal } from "@/lib/ratings-by-market";
import { MarketRatingRow } from "./MarketRatingRow";
import { OVERVIEW_SECTION } from "./overview-sections";
import { RatingsByMarketHelp } from "./RatingsByMarketHelp";
import { RatingsByMarketSkeleton } from "./skeletons";

function RatingsTable({
  markets,
  selected,
}: {
  markets: readonly ListingMarket[];
  selected: string | undefined;
}) {
  const t = useTranslations("overview");
  const locale = useAppLocale();
  const rows = marketRatingRows(markets);
  const total = ratingTotal(rows);
  return (
    <Table
      density="compact"
      scrollLabel={t("ratingsByMarket.tableLabel")}
      scrollFocus="overflow"
    >
      <TableCaption>{t("ratingsByMarket.caption")}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">{t("ratingsByMarket.market")}</TableHead>
          <TableHead scope="col" className="text-right">
            {t("ratingsByMarket.average")}
          </TableHead>
          <TableHead scope="col" className="text-right">
            {t("ratingsByMarket.ratings")}
          </TableHead>
          <TableHead scope="col" className="text-right max-sm:hidden">
            {t("ratingsByMarket.captured")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <MarketRatingRow
            key={row.country}
            row={row}
            selected={row.country === selected}
          />
        ))}
      </TableBody>
      {total ? (
        <TableFooter>
          <TableRow>
            <TableCell>{t("ratingsByMarket.allMarkets")}</TableCell>
            <TableCell className="text-right">
              <GradedNumber
                value={formatRatingInLocale(total.average, locale)}
                grade={grade("rating", total.average)}
                label={t("ratingsByMarket.averageAria")}
              />
            </TableCell>
            <TableCell className="numeric text-right">
              {formatNumberInLocale(total.count, locale)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground max-sm:hidden">
              {t("ratingsByMarket.marketCount", { count: total.markets })}
            </TableCell>
          </TableRow>
        </TableFooter>
      ) : null}
    </Table>
  );
}

function SingleMarket({ id, canTrack }: { id: string; canTrack: boolean }) {
  const t = useTranslations("overview");
  return (
    <EmptyState
      className="py-8"
      title={t("ratingsByMarket.onlyOneTitle")}
      body={t("ratingsByMarket.onlyOneBody")}
      action={
        canTrack ? (
          <Button asChild variant="outline">
            <Link href={`/apps/${id}/keywords`}>
              {t("ratingsByMarket.trackAnother")}
            </Link>
          </Button>
        ) : undefined
      }
    />
  );
}

function RatingsByMarketBody({
  id,
  canTrack,
}: {
  id: string;
  canTrack: boolean;
}) {
  const { markets, scope } = useMarket(id);
  return offersMarkets(markets) ? (
    <RatingsTable markets={markets} selected={scope} />
  ) : (
    <SingleMarket id={id} canTrack={canTrack} />
  );
}

export function RatingsByMarketCard({
  id,
  canTrack,
  collapsed,
}: {
  id: string;
  canTrack: boolean;
  collapsed: readonly string[];
}) {
  const t = useTranslations("overview");
  return (
    <CollapsedSectionsProvider initial={collapsed} known={KNOWN_SECTIONS}>
      <CollapsibleCard
        section={OVERVIEW_SECTION.ratingsByMarket}
        title={t("ratingsByMarket.title")}
        actions={<RatingsByMarketHelp />}
      >
        <Suspense fallback={<RatingsByMarketSkeleton />}>
          <RatingsByMarketBody id={id} canTrack={canTrack} />
        </Suspense>
      </CollapsibleCard>
    </CollapsedSectionsProvider>
  );
}
