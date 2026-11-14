"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type {
  AppLocalizationsResult,
  KeywordFieldSuggestion,
} from "@asobeast/shared";
import { useAuth } from "@/components/auth/use-auth";
import { KeywordFieldSuggestionRow } from "@/components/KeywordFieldSuggestionCard";
import { ErrorState } from "@/components/layout/ErrorState";
import {
  FOOTER_LINK,
  PANEL_ACTION,
  PANEL_BLEED,
  PANEL_HEADER,
} from "@/components/layout/panel-classes";
import { keywordFieldSpace } from "@/components/metadata/metadata-status";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  LOCALIZATIONS_SECTION_ID,
  localizationMatrix,
  suggestedHint,
} from "@/lib/app-localizations";
import {
  APPLE_LOCALIZATIONS_URL,
  LOCALIZED_FIELDS_NOTE,
} from "@/lib/localizations";
import { useFocusGroupClaim } from "@/lib/focus-handoff";
import {
  appLocalizationsOptions,
  marketSuggestionsOptions,
} from "@/lib/queries";
import { STORE_CONNECTIONS_PATH } from "@/lib/store-connection-copy";
import { AddLocalizationDialog } from "./AddLocalizationDialog";
import { FindLocalizationsButton } from "./FindLocalizationsButton";
import {
  ImportFromStoreButton,
  STORE_IMPORT_FOCUS_KEY,
} from "./ImportFromStoreButton";
import { LocalizationList } from "./LocalizationList";
import { LocalizationMatrix } from "./LocalizationMatrix";
import { SUB_HEADER, SUB_HEADER_COUNT, SUB_HEADER_NOTE } from "./panel-rows";
import { StopImportButton } from "./StopImportButton";
import { UnlistedLocalizations } from "./UnlistedLocalizations";

const HEADING_ID = "app-localizations-heading";

function useScrollIntoViewOnHash(ready: boolean) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ready && window.location.hash === `#${LOCALIZATIONS_SECTION_ID}`) {
      ref.current?.scrollIntoView({ block: "start" });
    }
  }, [ready]);
  return ref;
}

function KeywordFieldsHeader({ result }: { result: AppLocalizationsResult }) {
  const space = keywordFieldSpace(result.localizations);
  return (
    <h3 className={SUB_HEADER}>
      <span>Keyword fields</span>
      <span className={SUB_HEADER_COUNT}>{result.localizations.length}</span>
      {space ? (
        <span className={SUB_HEADER_NOTE}>
          {`${formatNumber(space.used)} of ${formatNumber(space.limit)} characters used`}
        </span>
      ) : null}
    </h3>
  );
}

function LocalizationsBody({
  id,
  result,
  canDraft,
  suggestion,
}: {
  id: string;
  result: AppLocalizationsResult;
  canDraft: boolean;
  suggestion: KeywordFieldSuggestion | null;
}) {
  const suggestions = useQuery({
    ...marketSuggestionsOptions(id),
    retry: false,
  });
  const grid = localizationMatrix(result, suggestions.data ?? null);

  return (
    <>
      <CardContent className={cn(PANEL_BLEED, "flex flex-col")}>
        {result.storeImport === "paused" ? (
          <p className="border-b border-border px-4 py-3 text-dense text-muted-foreground">
            Importing from App Store Connect is paused because the connection
            needs attention in{" "}
            <Link
              href={STORE_CONNECTIONS_PATH}
              className="font-medium text-foreground link-underline"
            >
              Integrations
            </Link>
            . The fields are editable here again and follow the store once the
            key works.
          </p>
        ) : null}
        {grid ? (
          <LocalizationMatrix
            grid={grid}
            hint={suggestedHint(id, grid.suggested)}
          />
        ) : null}
        <KeywordFieldsHeader result={result} />
        <LocalizationList id={id} result={result} canDraft={canDraft} />
        {suggestion && !result.storeManaged ? (
          <KeywordFieldSuggestionRow
            id={id}
            home={result.home}
            suggestion={suggestion}
          />
        ) : null}
        <UnlistedLocalizations id={id} result={result} />
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-y-1">
        <span>{LOCALIZED_FIELDS_NOTE}</span>
        <a
          href={APPLE_LOCALIZATIONS_URL}
          target="_blank"
          rel="noreferrer"
          className={FOOTER_LINK}
        >
          Apple&rsquo;s localization table
        </a>
      </CardFooter>
    </>
  );
}

function LocalizationsHelp() {
  return (
    <InfoTip
      label="About App Store localizations"
      title="A keyword field belongs to a language"
      summary="Search in every storefront on its list reads it, and words combine only within one localization."
    />
  );
}

export function AppLocalizationsSection({
  id,
  canDraft,
  suggestion,
}: {
  id: string;
  canDraft: boolean;
  suggestion: KeywordFieldSuggestion | null;
}) {
  const { isOwner } = useAuth();
  const { data, error, isError, refetch } = useQuery({
    ...appLocalizationsOptions(id),
    retry: false,
  });
  const sectionRef = useScrollIntoViewOnHash(data !== undefined);
  const controls = useFocusGroupClaim(
    STORE_IMPORT_FOCUS_KEY,
    isOwner &&
      (data?.storeImport === "following" || data?.storeImport === "paused"),
  );

  return (
    <section
      ref={sectionRef}
      id={LOCALIZATIONS_SECTION_ID}
      aria-labelledby={HEADING_ID}
      className="scroll-mt-20"
    >
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={HEADING_ID}>App Store localizations</h2>
          </CardTitle>
          <CardAction
            className={cn(
              PANEL_ACTION,
              "flex flex-wrap items-center justify-end gap-2 max-sm:col-span-2 max-sm:col-start-1 max-sm:row-start-2 max-sm:justify-start max-sm:justify-self-start",
            )}
          >
            {data ? (
              <div ref={controls} className="contents">
                <FindLocalizationsButton appId={id} />
                {data.storeImport === "following" ? null : (
                  <AddLocalizationDialog id={id} result={data} />
                )}
                {isOwner && data.storeImport === "available" ? (
                  <ImportFromStoreButton id={id} result={data} />
                ) : null}
                {isOwner &&
                (data.storeImport === "following" ||
                  data.storeImport === "paused") ? (
                  <StopImportButton id={id} />
                ) : null}
              </div>
            ) : null}
            <LocalizationsHelp />
          </CardAction>
        </CardHeader>
        {data ? (
          <LocalizationsBody
            id={id}
            result={data}
            canDraft={canDraft}
            suggestion={suggestion}
          />
        ) : (
          <CardContent>
            {isError ? (
              <ErrorState
                error={error}
                retry={() => void refetch()}
                title="Localizations could not be loaded."
              />
            ) : (
              <Skeleton className="h-64 w-full" />
            )}
          </CardContent>
        )}
      </Card>
    </section>
  );
}
