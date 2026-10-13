"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import type { AppLocalizationsResult } from "@asobeast/shared";
import { ErrorState } from "@/components/layout/ErrorState";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LOCALIZATIONS_SECTION_ID,
  localizationMatrix,
} from "@/lib/app-localizations";
import {
  APPLE_LOCALIZATIONS_URL,
  LOCALIZED_FIELDS_NOTE,
} from "@/lib/localizations";
import { appLocalizationsOptions } from "@/lib/queries";
import { AddLocalizationDialog } from "./AddLocalizationDialog";
import { FindLocalizationsButton } from "./FindLocalizationsButton";
import { LocalizationList } from "./LocalizationList";
import { LocalizationMatrix } from "./LocalizationMatrix";

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

function LocalizationsPanel({
  id,
  result,
  canDraft,
}: {
  id: string;
  result: AppLocalizationsResult;
  canDraft: boolean;
}) {
  const grid = localizationMatrix(result);

  return (
    <Card className="min-w-0">
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-body text-muted-foreground">
            A keyword field belongs to a language. Search in every storefront on
            its list reads it, and words combine only within one localization.{" "}
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
        </div>
        {grid ? <LocalizationMatrix grid={grid} /> : null}
        <LocalizationList id={id} result={result} canDraft={canDraft} />
      </CardContent>
    </Card>
  );
}

export function AppLocalizationsSection({
  id,
  canDraft,
}: {
  id: string;
  canDraft: boolean;
}) {
  const { data, error, isError, refetch } = useQuery({
    ...appLocalizationsOptions(id),
    retry: false,
  });
  const sectionRef = useScrollIntoViewOnHash(data !== undefined);

  return (
    <section
      ref={sectionRef}
      id={LOCALIZATIONS_SECTION_ID}
      aria-labelledby={HEADING_ID}
      className="flex scroll-mt-20 flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={HEADING_ID} className="text-lg font-medium">
          App Store localizations
        </h2>
        {data ? (
          <div className="flex flex-wrap items-center gap-2">
            <FindLocalizationsButton appId={id} />
            <AddLocalizationDialog id={id} result={data} />
          </div>
        ) : null}
      </div>
      {data ? (
        <LocalizationsPanel id={id} result={data} canDraft={canDraft} />
      ) : isError ? (
        <ErrorState
          error={error}
          retry={() => void refetch()}
          title="Localizations could not be loaded."
        />
      ) : (
        <Skeleton className="h-64 w-full rounded-xl" />
      )}
    </section>
  );
}
