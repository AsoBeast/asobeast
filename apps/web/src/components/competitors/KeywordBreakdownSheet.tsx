"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import {
  APP_STORE_LOCALIZATIONS,
  isAppStoreLocalization,
} from "@asobeast/shared";
import type {
  KeywordBreakdownApp,
  KeywordBreakdownField,
  MetadataField,
} from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  countryFlag,
  formatCountry,
  formatList,
  formatNumber,
  formatRating,
} from "@/lib/format";
import { keywordBreakdownOptions } from "@/lib/queries";
import { breakdownParser } from "@/lib/search-params";
import { PositionCell } from "./comparison-columns";
import { UNNAMED_COMPETITOR } from "./comparison-scores";
import {
  highlightTerms,
  matchLabel,
  matchStrength,
  type MatchStrength,
} from "./keyword-highlight";

const FIELD_LABELS: Partial<Record<MetadataField, string>> = {
  title: "Title",
  subtitle: "Subtitle",
  shortDescription: "Short description",
  keywordField: "Keyword field",
};

const displayValue = (field: KeywordBreakdownField, value: string): string =>
  field.field === "keywordField" ? value.replaceAll(",", ", ") : value;

const STRENGTH_VARIANT: Record<
  MatchStrength,
  "success" | "secondary" | "outline"
> = {
  phrase: "success",
  partial: "secondary",
  none: "outline",
};

function FieldRow({
  field,
  total,
}: {
  field: KeywordBreakdownField;
  total: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {FIELD_LABELS[field.field] ?? field.field}
        </span>
        {field.value === null ? null : (
          <Badge variant={STRENGTH_VARIANT[matchStrength(field)]}>
            {matchLabel(field, total)}
          </Badge>
        )}
      </div>
      {field.value === null ? (
        <span className="text-muted-foreground">Empty</span>
      ) : (
        <span>
          {highlightTerms(displayValue(field, field.value), field.terms).map(
            (part, index) =>
              part.match ? (
                <mark
                  key={index}
                  className="rounded-sm bg-success-subtle font-medium text-foreground"
                >
                  {part.text}
                </mark>
              ) : (
                <span key={index}>{part.text}</span>
              ),
          )}
        </span>
      )}
    </div>
  );
}

function localizationName(id: string): string {
  return isAppStoreLocalization(id) ? APP_STORE_LOCALIZATIONS[id] : id;
}

function LocalizedListings({
  app,
  total,
}: {
  app: KeywordBreakdownApp;
  total: number;
}) {
  const matching = app.localizations.filter((entry) => entry.matchedTerms > 0);
  const silent = app.localizations.filter((entry) => entry.matchedTerms === 0);
  return (
    <>
      {matching.map((entry) => (
        <div
          key={entry.localization}
          role="group"
          aria-label={`${localizationName(entry.localization)} listing`}
          className="flex flex-col gap-2 border-t pt-3"
        >
          <span className="text-xs font-medium">
            {localizationName(entry.localization)} listing
          </span>
          {entry.fields.map((field) => (
            <FieldRow key={field.field} field={field} total={total} />
          ))}
        </div>
      ))}
      {silent.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          No match in its{" "}
          {formatList(
            silent.map((entry) => localizationName(entry.localization)),
          )}{" "}
          {silent.length === 1 ? "listing" : "listings"}.
        </p>
      ) : null}
      {app.unreadLocalizations.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Not captured, so not checked:{" "}
          {formatList(app.unreadLocalizations.map(localizationName))}.
        </p>
      ) : null}
    </>
  );
}

function AppRow({
  app,
  total,
  country,
}: {
  app: KeywordBreakdownApp;
  total: number;
  country: string;
}) {
  const name = app.name ?? UNNAMED_COMPETITOR;
  return (
    <li aria-label={name} className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <span aria-hidden>
          <AppIcon src={app.iconUrl} name={app.name} size={24} />
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
        {app.isYou ? <Badge>You</Badge> : null}
        <PositionCell value={app.position} best={false} />
      </div>
      {app.listingCountry === null ? (
        <p className="text-muted-foreground">
          No listing captured for this app yet.
        </p>
      ) : (
        <>
          {app.fields.map((field) => (
            <FieldRow key={field.field} field={field} total={total} />
          ))}
          <LocalizedListings app={app} total={total} />
          <p className="text-xs text-muted-foreground">
            {total > 1
              ? `${app.matchedTerms} of ${total} keyword words in the listing`
              : null}
            {total > 1 && app.ratingAvg !== null ? " · " : null}
            {app.ratingAvg !== null
              ? `${formatRating(app.ratingAvg)} rating${
                  app.ratingCount !== null
                    ? ` from ${formatNumber(app.ratingCount)}`
                    : ""
                }`
              : null}
          </p>
          {app.listingCountry !== country ? (
            <p className="text-xs text-muted-foreground">
              No {formatCountry(country)} listing captured, showing the{" "}
              {formatCountry(app.listingCountry)} one.
            </p>
          ) : null}
        </>
      )}
    </li>
  );
}

function BreakdownRows({
  appId,
  keywordId,
}: {
  appId: string;
  keywordId: string;
}) {
  const { data } = useSuspenseQuery(keywordBreakdownOptions(appId, keywordId));
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 font-medium">
        <span aria-hidden>{countryFlag(data.country)}</span>
        <span>{data.text}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {formatCountry(data.country)}
        </span>
      </p>
      <ul className="flex flex-col gap-2">
        {data.apps.map((app) => (
          <AppRow
            key={app.appId}
            app={app}
            total={data.terms.length}
            country={data.country}
          />
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        A market searches every language version of a listing it offers, so
        those are read too where they were captured. Search also reads fields
        only the developer sees, such as the App Store keyword field, so a
        competitor can rank without the words showing here.
      </p>
    </div>
  );
}

function BreakdownSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-40" />
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-32 w-full" />
      ))}
    </div>
  );
}

export function KeywordBreakdownSheet({ appId }: { appId: string }) {
  const [keywordId, setKeywordId] = useQueryState("keyword", breakdownParser);
  const open = keywordId.length > 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) void setKeywordId("");
      }}
    >
      <SheetContent aria-describedby="breakdown-description">
        <SheetHeader>
          <SheetTitle>Why apps rank for this keyword</SheetTitle>
          <SheetDescription id="breakdown-description">
            Where the keyword appears in your listing and in each
            competitor&apos;s, beside the position on the latest daily check.
          </SheetDescription>
        </SheetHeader>
        {open ? (
          <div className="overflow-y-auto">
            <Suspense fallback={<BreakdownSkeleton />}>
              <BreakdownRows appId={appId} keywordId={keywordId} />
            </Suspense>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
