import { useId } from "react";
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
import { formatCountry, formatDate, formatList } from "@/lib/format";
import { localizationName } from "@/lib/localizations";
import {
  insightText,
  rankingLabel,
  ratingLine,
  standingLines,
} from "./breakdown-text";
import { BreakdownField } from "./BreakdownField";
import { PositionCell } from "./comparison-columns";
import { UNNAMED_COMPETITOR } from "./comparison-scores";

type Breakdown = Pick<KeywordBreakdown, "store" | "country" | "standing">;

function noteOf(app: KeywordBreakdownApp, breakdown: Breakdown): string[] {
  if (app.isYou) return standingLines(breakdown.standing);
  const text = app.insight
    ? insightText(app.insight, breakdown.store, app.placement)
    : null;
  return text === null ? [] : [text];
}

function sourceLine(app: KeywordBreakdownApp, market: string): string | null {
  if (app.listingCountry === null)
    return "No listing captured for this app yet.";
  if (app.listingCountry === market) return null;
  return `No ${formatCountry(market)} listing captured for this app, so its ${formatCountry(app.listingCountry)} listing was read.`;
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
  const { localization, role } = listing;
  const missingField =
    app.isYou &&
    localization !== null &&
    isAppStoreLocalization(localization) &&
    listing.fields.some(isEmptyField);
  return (
    <section className="flex flex-col gap-2 rounded-lg bg-muted p-3">
      {localization === null ? null : (
        <h4 className="flex flex-wrap items-center gap-2 text-xs font-medium">
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
        <p className="text-xs text-muted-foreground">
          No keyword field saved for {localizationName(localization)}.{" "}
          <Link
            href={editLocalizationHref(appId, localization)}
            className="underline decoration-primary underline-offset-4"
          >
            Edit it on the metadata page
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
  const headingId = useId();
  const note = noteOf(app, breakdown);
  const source = sourceLine(app, breakdown.country);
  const rating = ratingLine(app, breakdown.country);
  const position = app.ranking?.position ?? null;
  return (
    <li
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden>
          <AppIcon src={app.iconUrl} name={app.name} size={32} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3
            id={headingId}
            className="flex flex-wrap items-center gap-2 font-medium"
          >
            <bdi className="wrap-anywhere">
              {app.name ?? UNNAMED_COMPETITOR}
            </bdi>
            {app.isYou ? <Badge>You</Badge> : null}
          </h3>
          {app.ranking ? (
            <span className="text-xs text-muted-foreground">
              Checked {formatDate(app.ranking.date)}
            </span>
          ) : null}
        </div>
        {position === null ? (
          <span className="shrink-0 font-mono text-sm text-muted-foreground">
            {rankingLabel(app.ranking)}
          </span>
        ) : (
          <PositionCell value={position} best={false} />
        )}
      </div>
      {note.length > 0 ? (
        <div
          role="note"
          aria-label={
            app.isYou ? "Where you stand" : "Why it may rank above you"
          }
          className="flex flex-col gap-1 border-l-2 border-info pl-3 text-sm"
        >
          {note.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
      {source ? (
        <p className="text-xs text-muted-foreground">{source}</p>
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
        <p className="text-xs text-muted-foreground">
          Not read: {formatList(app.unread.map(localizationName))}.
        </p>
      ) : null}
      {rating ? (
        <p className="text-xs text-muted-foreground">{rating}</p>
      ) : null}
    </li>
  );
}
