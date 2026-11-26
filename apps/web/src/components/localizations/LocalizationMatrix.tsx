"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SUGGESTED_COLUMNS,
  type LocalizationGrid,
  type SuggestedMarketHint,
} from "@/lib/app-localizations";
import { formatCountryInLocale } from "@/lib/format";
import { localizationNameInLocale } from "@/lib/localizations";
import { useAppLocale } from "@/lib/use-app-locale";
import { OriginMark } from "./OriginMark";
import { ReadRoleBadge } from "./ReadRoleBadge";

function NotRead() {
  const t = useTranslations("localizations");
  return (
    <>
      <span aria-hidden className="text-muted-foreground">
        ·
      </span>
      <span className="sr-only">{t("matrix.notRead")}</span>
    </>
  );
}

const SUGGESTED_COLUMN = "border-l border-dashed border-border";

export function LocalizationMatrix({
  grid,
  hint,
}: {
  grid: LocalizationGrid;
  hint: SuggestedMarketHint | null;
}) {
  const t = useTranslations("localizations");
  const locale = useAppLocale();
  const columns = [...grid.markets, ...grid.suggested];
  return (
    <div className="flex min-w-0 flex-col">
      <Table scrollLabel={t("matrix.scroll")} scrollFocus="overflow">
        <TableCaption className="sr-only">
          {grid.suggested.length > 0
            ? t("matrix.captionSuggested", { count: SUGGESTED_COLUMNS })
            : t("matrix.caption")}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{t("matrix.readMarkets")}</TableHead>
            {grid.markets.map((country) => (
              <TableHead
                key={country}
                scope="col"
                title={formatCountryInLocale(country, locale)}
              >
                {country.toUpperCase()}
                <span className="sr-only">
                  {" "}
                  {formatCountryInLocale(country, locale)}
                </span>
              </TableHead>
            ))}
            {grid.suggested.map((country) => (
              <TableHead
                key={country}
                scope="col"
                title={t("matrix.suggestedTitle", {
                  market: formatCountryInLocale(country, locale),
                })}
                className={SUGGESTED_COLUMN}
              >
                {country.toUpperCase()}{" "}
                <span className="font-normal">{t("matrix.suggested")}</span>
                <span className="sr-only">
                  {" "}
                  {formatCountryInLocale(country, locale)}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {grid.rows.map((row) => (
            <TableRow key={row.localization}>
              <TableHead scope="row" className="text-dense text-foreground">
                <span className="mr-2 font-medium">
                  {localizationNameInLocale(row.localization, locale)}
                </span>
                <OriginMark origin={row.origin} />
              </TableHead>
              {row.cells.map((role, index) => (
                <TableCell
                  key={columns[index]}
                  className={
                    index >= grid.markets.length ? SUGGESTED_COLUMN : undefined
                  }
                >
                  {role === null ? <NotRead /> : <ReadRoleBadge role={role} />}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hint ? (
        <p className="border-t border-border-subtle px-4 py-2 text-caption text-faint-foreground">
          {hint.text}{" "}
          <Link
            href={hint.href}
            className="font-medium text-foreground link-underline"
          >
            {hint.link}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
