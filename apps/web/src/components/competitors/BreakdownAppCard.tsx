import { useId } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  isAppStoreLocalization,
  type KeywordBreakdown,
  type KeywordBreakdownApp,
  type KeywordBreakdownListing,
} from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { ReadRoleBadge } from "@/components/localizations/ReadRoleBadge";
import { Badge } from "@/components/ui/badge";
import { editLocalizationHref } from "@/lib/app-localizations";
import {
  formatCountryInLocale,
  formatDateInLocale,
  formatListInLocale,
} from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { localizationName } from "@/lib/localizations";
import {
  insightText,
  rankingLabel,
  ratingLine,
  standingLines,
} from "./breakdown-text";
import { BreakdownField } from "./BreakdownField";
import { PositionCell } from "./comparison-cells";

type Breakdown = Pick<KeywordBreakdown, "store" | "country" | "standing">;

function noteOf(
  app: KeywordBreakdownApp,
  breakdown: Breakdown,
  t: MessageTranslator,
  locale: Locale,
): string[] {
  if (app.isYou) return standingLines(breakdown.standing, t, locale);
  const text = app.insight
    ? insightText(app.insight, breakdown.store, app.placement, { t, locale })
    : null;
  return text === null ? [] : [text];
}

function sourceLine(
  app: KeywordBreakdownApp,
  market: string,
  t: MessageTranslator,
  locale: Locale,
): string | null {
  if (app.listingCountry === null) return t("breakdown.noListing");
  if (app.listingCountry === market) return null;
  return t("breakdown.otherListing", {
    market: formatCountryInLocale(market, locale),
    other: formatCountryInLocale(app.listingCountry, locale),
  });
}

const isEmptyField = (field: KeywordBreakdownListing["fields"][number]) =>
  field.field === "keywordField" && field.segments?.length === 0;

function ListingBlock({
  appId,
  app,
  listing,
}: {
  appId: string;
  app: KeywordBreakdownApp;
  listing: KeywordBreakdownListing;
}) {
  const t = useTranslations("competitors");
  const { localization, role } = listing;
  const missingField =
    app.isYou &&
    localization !== null &&
    isAppStoreLocalization(localization) &&
    listing.fields.some(isEmptyField);
  return (
    <section className="flex flex-col gap-2 rounded-lg bg-muted p-3">
      {localization === null ? null : (
        <h4 className="flex flex-wrap items-center gap-2 text-label">
          {localizationName(localization)}
          {role === null ? null : <ReadRoleBadge role={role} />}
        </h4>
      )}
      {listing.fields
        .filter((field) => !isEmptyField(field))
        .map((field) => (
          <BreakdownField key={field.field} field={field} />
        ))}
      {missingField ? (
        <p className="text-caption text-muted-foreground">
          {t("breakdown.missingKeywordField", {
            localization: localizationName(localization),
          })}{" "}
          <Link
            href={editLocalizationHref(appId, localization)}
            className="link-underline"
          >
            {t("breakdown.editMetadata")}
          </Link>
        </p>
      ) : null}
    </section>
  );
}

export function BreakdownAppCard({
  appId,
  app,
  breakdown,
}: {
  appId: string;
  app: KeywordBreakdownApp;
  breakdown: Breakdown;
}) {
  const t = useTranslations("competitors");
  const locale = useAppLocale();
  const headingId = useId();
  const note = noteOf(app, breakdown, t, locale);
  const source = sourceLine(app, breakdown.country, t, locale);
  const rating = ratingLine(app, breakdown.country, t, locale);
  const position = app.ranking?.position ?? null;
  return (
    <li
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-lg border bg-card p-4"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden>
          <AppIcon src={app.iconUrl} size={32} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3
            id={headingId}
            className="flex flex-wrap items-center gap-2 font-medium"
          >
            <bdi className="wrap-anywhere">{app.name ?? t("unnamed")}</bdi>
            {app.isYou ? <Badge>{t("standing.you")}</Badge> : null}
          </h3>
          {app.ranking ? (
            <span className="text-caption text-muted-foreground">
              {t("breakdown.checked", {
                date: formatDateInLocale(app.ranking.date, locale),
              })}
            </span>
          ) : null}
        </div>
        {position === null ? (
          <span className="shrink-0 numeric text-body text-muted-foreground">
            {rankingLabel(app.ranking, t)}
          </span>
        ) : (
          <PositionCell value={position} best={false} />
        )}
      </div>
      {note.length > 0 ? (
        <div
          role="note"
          aria-label={
            app.isYou ? t("breakdown.whereYouStand") : t("breakdown.whyAbove")
          }
          className="flex flex-col gap-1 border-l-2 border-border pl-3 text-dense"
        >
          {note.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
      {source ? (
        <p className="text-caption text-muted-foreground">{source}</p>
      ) : null}
      {app.listings.map((listing) => (
        <ListingBlock
          key={listing.localization ?? "listing"}
          appId={appId}
          app={app}
          listing={listing}
        />
      ))}
      {app.unread.length > 0 ? (
        <p className="text-caption text-muted-foreground">
          {t("breakdown.notRead", {
            localizations: formatListInLocale(
              app.unread.map(localizationName),
              locale,
            ),
          })}
        </p>
      ) : null}
      {rating ? (
        <p className="text-caption text-muted-foreground">{rating}</p>
      ) : null}
    </li>
  );
}
