"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { APP_STORE_LOCALIZATIONS } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCountry } from "@/lib/format";
import {
  APPLE_LOCALIZATIONS_URL,
  extraRoom,
  LOCALIZED_FIELDS_NOTE,
  storefrontRows,
  type StorefrontRow,
} from "@/lib/localizations";
import { appDetailOptions, keywordCountriesOptions } from "@/lib/queries";

const HEADING_ID = "storefront-localizations-heading";

function useStorefrontRows(id: string): StorefrontRow[] {
  const { data: app } = useSuspenseQuery(appDetailOptions(id));
  const { data: markets } = useSuspenseQuery(keywordCountriesOptions(id));
  return storefrontRows(
    app.country,
    markets.map((market) => market.country),
  );
}

function StorefrontItem({ row }: { row: StorefrontRow }) {
  const name = formatCountry(row.country);

  return (
    <li className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-foreground">{name}</h3>
        {row.home ? <Badge variant="outline">Home storefront</Badge> : null}
      </div>
      <p className="text-body text-muted-foreground">
        Default language: {APP_STORE_LOCALIZATIONS[row.primary]}
      </p>
      {row.additional.length === 0 ? (
        <p className="text-body text-muted-foreground">
          Apple lists no additional language for this storefront.
        </p>
      ) : (
        <>
          <p className="text-body text-foreground">
            {extraRoom(row.additional.length, row.country)}
          </p>
          <ul
            aria-label={`Additional languages in ${name}`}
            className="flex flex-wrap gap-2"
          >
            {row.additional.map((localization) => (
              <li key={localization}>
                <Badge variant="secondary">
                  {APP_STORE_LOCALIZATIONS[localization]}
                </Badge>
              </li>
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

export function StorefrontLocalizationsCard({ id }: { id: string }) {
  const rows = useStorefrontRows(id);
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby={HEADING_ID} className="flex flex-col gap-3">
      <h2 id={HEADING_ID} className="text-lg font-medium">
        Storefront localizations
      </h2>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <p className="text-body text-muted-foreground">
            Apple lists a default language and additional languages for every
            App Store storefront. In practice, search in a storefront reads the
            title, subtitle and keyword field of each language on its list, and
            words combine only within one localization.{" "}
            <a
              href={APPLE_LOCALIZATIONS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4"
            >
              Apple&rsquo;s localization table
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </p>
          <p className="text-body text-foreground">{LOCALIZED_FIELDS_NOTE}</p>
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <StorefrontItem key={row.country} row={row} />
            ))}
          </ul>
          <p className="text-caption text-muted-foreground">
            asobeast reads one listing of this app, so it cannot tell which of
            these localizations you have already filled in App Store Connect.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
