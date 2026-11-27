"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import Link from "next/link";
import { defaultLocalizationIn } from "@asobeast/shared";
import { AppLocalizationsSection } from "@/components/localizations/AppLocalizationsSection";
import { useLocalization } from "@/components/app-detail/use-localization";
import { useMarket } from "@/components/app-detail/use-market";
import { KeywordFieldSuggestionCard } from "@/components/KeywordFieldSuggestionCard";
import { MetadataFieldCard } from "@/components/MetadataFieldCard";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { queryMarket } from "@/lib/market";
import { appDetailOptions, metadataAuditOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { CoverageByField } from "./CoverageByField";
import { COVERAGE_SECTION_ID } from "./coverage-summary";
import { CoverageTable } from "./CoverageTable";
import { densityContext } from "./density/density-inputs";
import { DescriptionDensity } from "./density/DescriptionDensity";
import { FieldsNote } from "./FieldsNote";
import { ListingDraftEditor } from "./draft/ListingDraftEditor";
import { MetadataAssistantPanel } from "./MetadataAssistantPanel";
import { useMetadataMode } from "./MetadataModeSwitch";
import { ScreenshotCaptionsCard } from "./ScreenshotCaptionsCard";
import { showsScreenshotText } from "./screenshot-text-marks";
import { ScreenshotCaptionsSkeleton } from "./skeletons";

const COVERAGE_HEADING_ID = "keyword-coverage-heading";

function NoKeywords({ id }: { id: string }) {
  return (
    <section id={COVERAGE_SECTION_ID} aria-labelledby={COVERAGE_HEADING_ID}>
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={COVERAGE_HEADING_ID}>Keyword coverage</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No keywords tracked yet"
            body="Track keywords to see how your metadata covers them."
            action={
              <Button asChild variant="outline">
                <Link href={`/apps/${id}/keywords`}>Open Keywords</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    </section>
  );
}

export function MetadataAuditView({
  id,
  canDraft,
  draftable,
  hasLocalizations,
  keywordFields,
  ownerWhileLoading,
}: {
  id: string;
  canDraft: boolean;
  draftable: boolean;
  hasLocalizations: boolean;
  keywordFields: boolean;
  ownerWhileLoading: boolean;
}) {
  const [mode] = useMetadataMode();
  const { market, home } = useMarket(id);
  const localization = useLocalization(id).localization ?? undefined;
  const { data: result } = useSuspenseQuery(
    metadataAuditOptions(id, queryMarket(market, home), localization),
  );
  const { data: app } = useSuspenseQuery(appDetailOptions(id));
  const density = densityContext(result, market, localization, app);
  const homeLocalization = defaultLocalizationIn(app, home);
  const title = result.fields.find((field) => field.field === "title")?.value;
  const isAppStore = result.store === "APP_STORE";
  const tracked = result.coverage.length > 0;
  const withScreenshotText = showsScreenshotText(
    result.coverage,
    result.screenshotText ?? null,
  );
  const suggestion = isAppStore ? result.keywordFieldSuggestion : null;
  const drafting = canDraft && market === home;
  const draftMode = draftable && mode === "draft";

  const coverageByField = tracked ? (
    <CoverageByField
      rows={result.coverage}
      withScreenshotText={withScreenshotText}
      className="col-span-12 @5xl/metadata:col-span-4"
    />
  ) : null;

  return (
    <>
      {draftMode ? (
        <ListingDraftEditor
          id={id}
          audit={result}
          app={app}
          market={market}
          localization={localization}
          density={density}
        />
      ) : (
        <div className="grid grid-cols-12 items-start gap-6">
          <div
            className={cn(
              "col-span-12 flex min-w-0 flex-col gap-3",
              tracked && "@5xl/metadata:col-span-8",
            )}
          >
            <section
              aria-label="Listing fields"
              className="grid grid-cols-1 gap-4 @2xl/metadata:grid-cols-2"
            >
              {result.fields.map((field) => (
                <MetadataFieldCard
                  key={`${market}:${localization ?? ""}:${field.field}`}
                  field={field.field}
                  value={field.value ?? ""}
                  limit={field.limit}
                  indexed={field.indexed}
                  issues={field.issues}
                  className={
                    field.field === "description"
                      ? "@2xl/metadata:col-span-2"
                      : undefined
                  }
                >
                  {field.field === "description"
                    ? (text) => (
                        <DescriptionDensity
                          text={text}
                          title={title ?? null}
                          context={density}
                        />
                      )
                    : undefined}
                </MetadataFieldCard>
              ))}
            </section>
            <FieldsNote id={id} keywordFields={keywordFields} />
          </div>
          {coverageByField}
        </div>
      )}

      {tracked ? (
        <CoverageTable
          rows={result.coverage}
          withScreenshotText={withScreenshotText}
        />
      ) : (
        <NoKeywords id={id} />
      )}

      {keywordFields ? (
        <AppLocalizationsSection
          id={id}
          canDraft={drafting}
          suggestion={suggestion}
          homeLocalization={homeLocalization}
          ownerWhileLoading={ownerWhileLoading}
        />
      ) : suggestion ? (
        <KeywordFieldSuggestionCard
          id={id}
          homeLocalization={homeLocalization}
          suggestion={suggestion}
        />
      ) : null}

      {drafting ? (
        <MetadataAssistantPanel
          appId={id}
          store={result.store}
          canLocalize={hasLocalizations}
        />
      ) : null}

      {isAppStore ? (
        <Suspense fallback={<ScreenshotCaptionsSkeleton />}>
          <ScreenshotCaptionsCard
            id={id}
            market={queryMarket(market, home)}
            localization={localization}
          />
        </Suspense>
      ) : null}
    </>
  );
}
