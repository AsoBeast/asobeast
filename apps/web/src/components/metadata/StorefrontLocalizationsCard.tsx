"use client";

import { ExternalLink, Sparkles } from "lucide-react";
import { useQueryState } from "nuqs";
import {
  APP_STORE_LOCALIZATIONS,
  type AppStoreLocalization,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCountry } from "@/lib/format";
import {
  APPLE_LOCALIZATIONS_URL,
  draftableLocalizations,
  extraRoom,
  LOCALIZED_FIELDS_NOTE,
  type StorefrontRow,
} from "@/lib/localizations";
import { draftLocaleParser } from "@/lib/search-params";
import { focusDraftLocalization } from "./DraftLocalizationSelect";
import { useStorefrontRows } from "./use-storefront-rows";

const HEADING_ID = "storefront-localizations-heading";

type DraftHandler = (localization: AppStoreLocalization) => void;

function LanguageChip({
  localization,
  onDraft,
}: {
  localization: AppStoreLocalization;
  onDraft: DraftHandler | null;
}) {
  const label = APP_STORE_LOCALIZATIONS[localization];
  if (!onDraft) return <Badge variant="secondary">{label}</Badge>;
  return (
    <Button
      variant="outline"
      size="xs"
      aria-label={`Draft with AI: ${label}`}
      onClick={() => onDraft(localization)}
    >
      <Sparkles aria-hidden />
      {label}
    </Button>
  );
}

function StorefrontItem({
  row,
  draftable,
  onDraft,
}: {
  row: StorefrontRow;
  draftable: ReadonlySet<AppStoreLocalization>;
  onDraft: DraftHandler | null;
}) {
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
                <LanguageChip
                  localization={localization}
                  onDraft={draftable.has(localization) ? onDraft : null}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

export function StorefrontLocalizationsCard({
  id,
  canDraft,
}: {
  id: string;
  canDraft: boolean;
}) {
  const rows = useStorefrontRows(id);
  const [, setDraftLocale] = useQueryState("draftLocale", draftLocaleParser);
  if (rows.length === 0) return null;
  const draftable = new Set(draftableLocalizations(rows));
  const onDraft = canDraft
    ? (localization: AppStoreLocalization) => {
        void setDraftLocale(localization);
        focusDraftLocalization();
      }
    : null;

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
          {canDraft ? (
            <p className="text-body text-foreground">
              Choose a language to draft its title, subtitle and keyword field
              in the AI drafts below.
            </p>
          ) : null}
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <StorefrontItem
                key={row.country}
                row={row}
                draftable={draftable}
                onDraft={onDraft}
              />
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
