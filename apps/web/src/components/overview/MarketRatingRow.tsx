"use client";

import { useTranslations } from "next-intl";
import { GradedNumber } from "@/components/ui/graded";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  formatCountryInLocale,
  formatDateInLocale,
  formatNumberInLocale,
  formatRatingInLocale,
} from "@/lib/format";
import { grade } from "@/lib/grade";
import { useAppLocale } from "@/lib/use-app-locale";
import type { MarketRatingRow as Row } from "@/lib/ratings-by-market";

function Dash({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function Average({ row, name }: { row: Row; name: string }) {
  const t = useTranslations("overview");
  const locale = useAppLocale();
  if (row.state === "uncaptured")
    return <Dash label={t("ratingsByMarket.notCaptured")} />;
  if (row.ratingAvg === null)
    return <Dash label={t("ratingsByMarket.noRating")} />;
  return (
    <GradedNumber
      value={formatRatingInLocale(row.ratingAvg, locale)}
      grade={grade("rating", row.ratingAvg)}
      label={t("ratingsByMarket.ratingIn", { country: name })}
    />
  );
}

function RatingCount({ row }: { row: Row }) {
  const t = useTranslations("overview");
  const locale = useAppLocale();
  if (row.state === "uncaptured")
    return <Dash label={t("ratingsByMarket.notCaptured")} />;
  if (row.ratingCount === null)
    return <Dash label={t("ratingsByMarket.noRating")} />;
  return (
    <span className="numeric">
      {formatNumberInLocale(row.ratingCount, locale)}
    </span>
  );
}

export function MarketRatingRow({
  row,
  selected,
}: {
  row: Row;
  selected: boolean;
}) {
  const t = useTranslations("overview");
  const locale = useAppLocale();
  const name = formatCountryInLocale(row.country, locale);
  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      aria-current={selected ? "true" : undefined}
    >
      <TableCell>
        <span className="flex flex-wrap items-center gap-x-2">
          <span className="numeric text-muted-foreground">
            {row.country.toUpperCase()}
          </span>
          <span className="font-medium">{name}</span>
          {row.home ? (
            <span className="text-label text-muted-foreground">
              {t("ratingsByMarket.home")}
            </span>
          ) : null}
          {selected ? (
            <span className="text-label text-muted-foreground">
              {t("ratingsByMarket.selected")}
            </span>
          ) : null}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <Average row={row} name={name} />
      </TableCell>
      <TableCell className="text-right">
        <RatingCount row={row} />
      </TableCell>
      <TableCell className="text-right max-sm:hidden">
        {row.capturedAt === null ? (
          <span className="text-muted-foreground">
            {t("ratingsByMarket.notCaptured")}
          </span>
        ) : (
          <span>{formatDateInLocale(row.capturedAt, locale)}</span>
        )}
      </TableCell>
    </TableRow>
  );
}
