"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMarket } from "@/components/app-detail/use-market";
import { KeywordFieldSuggestionCard } from "@/components/KeywordFieldSuggestionCard";
import { MetadataFieldCard } from "@/components/MetadataFieldCard";
import { queryMarket } from "@/lib/market";
import { metadataAuditOptions } from "@/lib/queries";
import { CoverageTable } from "./CoverageTable";
import { MetadataAssistantPanel } from "./MetadataAssistantPanel";
import { ScreenshotCaptionsCard } from "./ScreenshotCaptionsCard";
import {
  ScreenshotCaptionsSkeleton,
  StorefrontLocalizationsSkeleton,
} from "./skeletons";
import { StorefrontLocalizationsCard } from "./StorefrontLocalizationsCard";

export function MetadataAuditView({
  id,
  canDraft,
  hasLocalizations,
}: {
  id: string;
  canDraft: boolean;
  hasLocalizations: boolean;
}) {
  const { market, home } = useMarket(id);
  const { data: result } = useSuspenseQuery(
    metadataAuditOptions(id, queryMarket(market, home)),
  );

  return (
    <>
      <section className="grid grid-cols-1 gap-4 @2xl/metadata:grid-cols-2">
        {result.fields.map((field) => (
          <MetadataFieldCard
            key={`${market}:${field.field}`}
            field={field.field}
            value={field.value ?? ""}
            limit={field.limit}
            issues={field.issues}
          />
        ))}
      </section>

      {result.store === "APP_STORE" ? (
        <Suspense fallback={<ScreenshotCaptionsSkeleton />}>
          <ScreenshotCaptionsCard id={id} market={queryMarket(market, home)} />
        </Suspense>
      ) : null}

      {hasLocalizations ? (
        <Suspense fallback={<StorefrontLocalizationsSkeleton />}>
          <StorefrontLocalizationsCard id={id} canDraft={canDraft} />
        </Suspense>
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

      {result.store === "APP_STORE" &&
      result.keywordFieldSuggestion !== null ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Suggestion</h2>
          <KeywordFieldSuggestionCard
            suggestion={result.keywordFieldSuggestion}
          />
        </section>
      ) : null}
    </>
  );
}
