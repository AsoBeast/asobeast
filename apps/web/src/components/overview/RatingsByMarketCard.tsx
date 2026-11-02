"use client";

import { Suspense } from "react";
import Link from "next/link";
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
import { formatNumber, formatRating, pluralize } from "@/lib/format";
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
  const rows = marketRatingRows(markets);
  const total = ratingTotal(rows);
  return (
    <Table scrollLabel="Market ratings table" scrollFocus="overflow">
      <TableCaption>
        Rating and number of ratings on the newest listing captured in each
        market
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Market</TableHead>
          <TableHead scope="col" className="text-right">
            Average
          </TableHead>
          <TableHead scope="col" className="text-right">
            Ratings
          </TableHead>
          <TableHead scope="col" className="text-right">
            Captured
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
            <TableCell>All listed markets</TableCell>
            <TableCell className="text-right">
              <GradedNumber
                value={formatRating(total.average)}
                grade={grade("rating", total.average)}
                label="Rating across the listed markets"
              />
            </TableCell>
            <TableCell className="numeric text-right font-mono">
              {formatNumber(total.count)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {pluralize(total.markets, "market")}
            </TableCell>
          </TableRow>
        </TableFooter>
      ) : null}
    </Table>
  );
}

function SingleMarket({ id, canTrack }: { id: string; canTrack: boolean }) {
  return (
    <EmptyState
      className="py-8"
      title="Only one market so far"
      body="The App Store keeps a rating for each storefront. Track a keyword in another market and the daily run captures the listing there, so its rating appears next to this one."
      action={
        canTrack ? (
          <Button asChild variant="outline">
            <Link href={`/apps/${id}/keywords`}>
              Track keywords in another market
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
  return (
    <CollapsedSectionsProvider initial={collapsed} known={KNOWN_SECTIONS}>
      <CollapsibleCard
        section={OVERVIEW_SECTION.ratingsByMarket}
        eyebrow="Store ratings"
        title="Ratings by market"
        actions={<RatingsByMarketHelp />}
      >
        <Suspense fallback={<RatingsByMarketSkeleton />}>
          <RatingsByMarketBody id={id} canTrack={canTrack} />
        </Suspense>
      </CollapsibleCard>
    </CollapsedSectionsProvider>
  );
}
