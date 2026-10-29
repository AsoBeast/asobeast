"use client";

import { Suspense } from "react";
import {
  useQuery,
  useSuspenseQuery,
  type UseQueryResult,
} from "@tanstack/react-query";
import { keywordFieldLocalizations } from "@asobeast/shared";
import type {
  AppLocalizationsResult,
  MetadataAuditResult,
} from "@asobeast/shared";
import { AppLocalizationsSection } from "@/components/localizations/AppLocalizationsSection";
import { useLocalization } from "@/components/app-detail/use-localization";
import { useMarket } from "@/components/app-detail/use-market";
import { KeywordFieldSuggestionCard } from "@/components/KeywordFieldSuggestionCard";
import { MetadataFieldCard } from "@/components/MetadataFieldCard";
import {
  InlineQueryError,
  failedRead,
} from "@/components/layout/InlineQueryError";
import { editLocalizationHref } from "@/lib/app-localizations";
import { queryMarket } from "@/lib/market";
import { appLocalizationsOptions, metadataAuditOptions } from "@/lib/queries";
import { CoverageTable } from "./CoverageTable";
import { MetadataAssistantPanel } from "./MetadataAssistantPanel";
import { ScreenshotCaptionsCard } from "./ScreenshotCaptionsCard";
import { ScreenshotCaptionsSkeleton } from "./skeletons";

function FieldSuggestion({
  id,
  home,
  read,
  suggestion,
}: {
  id: string;
  home: string;
  read: UseQueryResult<AppLocalizationsResult>;
  suggestion: MetadataAuditResult["keywordFieldSuggestion"];
}) {
  if (failedRead(read)) {
    return (
      <InlineQueryError
        message="The localizations could not be read."
        read={read}
      />
    );
  }
  if (suggestion === null) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Suggestion</h2>
      <KeywordFieldSuggestionCard
        suggestion={suggestion}
        editHref={editLocalizationHref(
          id,
          suggestion.localization ?? keywordFieldLocalizations(home)[0],
        )}
      />
    </section>
  );
}

export function MetadataAuditView({
  id,
  canDraft,
  hasLocalizations,
  keywordFields,
}: {
  id: string;
  canDraft: boolean;
  hasLocalizations: boolean;
  keywordFields: boolean;
}) {
  const { market, home } = useMarket(id);
  const localization = useLocalization(id).localization ?? undefined;
  const { data: result } = useSuspenseQuery(
    metadataAuditOptions(id, queryMarket(market, home), localization),
  );
  const localizations = useQuery({
    ...appLocalizationsOptions(id),
    enabled: keywordFields,
    retry: false,
  });
  const storeManaged = localizations.data?.storeManaged ?? false;

  return (
    <>
      <section className="grid grid-cols-1 gap-4 @2xl/metadata:grid-cols-2">
        {result.fields.map((field) => (
          <MetadataFieldCard
            key={`${market}:${localization ?? ""}:${field.field}`}
            field={field.field}
            value={field.value ?? ""}
            limit={field.limit}
            issues={field.issues}
          />
        ))}
      </section>

      {result.store === "APP_STORE" ? (
        <Suspense fallback={<ScreenshotCaptionsSkeleton />}>
          <ScreenshotCaptionsCard
            id={id}
            market={queryMarket(market, home)}
            localization={localization}
          />
        </Suspense>
      ) : null}

      {keywordFields ? (
        <AppLocalizationsSection
          id={id}
          canDraft={canDraft && market === home}
        />
      ) : null}

      {canDraft && market === home ? (
        <MetadataAssistantPanel
          appId={id}
          store={result.store}
          canLocalize={hasLocalizations}
        />
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Keyword coverage</h2>
        {result.coverage.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Track keywords to see how your metadata covers them.
          </div>
        ) : (
          <CoverageTable
            rows={result.coverage}
            screenshotText={result.screenshotText ?? null}
          />
        )}
      </section>

      {result.store === "APP_STORE" && !storeManaged ? (
        <FieldSuggestion
          id={id}
          home={home}
          read={localizations}
          suggestion={result.keywordFieldSuggestion}
        />
      ) : null}
    </>
  );
}
