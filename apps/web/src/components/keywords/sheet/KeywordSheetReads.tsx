"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  SERP_DEPTH,
  type SerpSnapshot,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { BreakdownAppCard } from "@/components/competitors/BreakdownAppCard";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import {
  appDetailOptions,
  keywordBreakdownOptions,
  serpOptions,
} from "@/lib/queries";
import { SerpList } from "../serp/SerpList";
import { isCaptured, type CapturedSerp } from "../serp/SerpSheet";
import { SerpNeverChecked, SerpNoApps, SerpSkeleton } from "../serp/SerpStates";
import { SerpSummary } from "../serp/SerpSummary";
import { serpSummary } from "../serp/serp-summary";
import { SheetSection } from "@/components/layout/SheetSection";

type Viewer = { appId: string; storeAppId: string | undefined };

function CapturedResults({
  snapshot,
  viewer,
  keyword,
  onOpenAll,
}: {
  snapshot: CapturedSerp;
  viewer: Viewer;
  keyword: TrackedKeywordItem;
  onOpenAll: () => void;
}) {
  const t = useTranslations("keywordInspector");
  const comparedTo = snapshot.comparedTo ?? null;
  const topTen = snapshot.entries.filter(
    (entry) => entry.position <= SERP_DEPTH,
  );
  return (
    <>
      <div className="-mx-4 flex flex-col">
        {snapshot.entries.length === 0 ? (
          <SerpNoApps date={snapshot.date} />
        ) : (
          <>
            <SerpSummary
              facts={serpSummary(snapshot, viewer, keyword)}
              comparedTo={comparedTo}
            />
            {topTen.length > 0 ? (
              <SerpList
                heading={t("serp.top10")}
                entries={topTen}
                viewer={viewer}
                comparedTo={comparedTo}
              />
            ) : null}
          </>
        )}
      </div>
      <div>
        <Button
          variant="outline"
          size="sm"
          data-serp-keyword={keyword.keywordId}
          onClick={onOpenAll}
        >
          {t("keywordSheet.results.all")}
        </Button>
      </div>
    </>
  );
}

export function KeywordSheetResults({
  appId,
  keyword,
  onOpenAll,
}: {
  appId: string;
  keyword: TrackedKeywordItem;
  onOpenAll: () => void;
}) {
  const serp = useQuery(serpOptions(keyword.keywordId, null));
  const { data: app } = useQuery(appDetailOptions(appId));
  const t = useTranslations("keywordInspector");
  const locale = useAppLocale();
  const viewer = { appId, storeAppId: app?.storeAppId };
  const snapshot = serp.data;
  const captured = isCaptured(snapshot) ? snapshot : null;

  return (
    <SheetSection
      title={t("keywordSheet.results.title")}
      aside={
        captured
          ? t("keywordSheet.results.captured", {
              date: formatDateInLocale(captured.date, locale),
            })
          : undefined
      }
    >
      <ResultsBody
        read={serp}
        captured={captured}
        viewer={viewer}
        keyword={keyword}
        onOpenAll={onOpenAll}
      />
    </SheetSection>
  );
}

function ResultsBody({
  read,
  captured,
  viewer,
  keyword,
  onOpenAll,
}: {
  read: UseQueryResult<SerpSnapshot>;
  captured: CapturedSerp | null;
  viewer: Viewer;
  keyword: TrackedKeywordItem;
  onOpenAll: () => void;
}) {
  const t = useTranslations("keywordInspector");
  if (failedRead(read)) {
    return (
      <InlineQueryError
        message={t("keywordSheet.results.loadFailed")}
        read={read}
      />
    );
  }
  if (!read.data) {
    return (
      <div role="status" className="-mx-4">
        <span className="sr-only">{t("keywordSheet.results.loading")}</span>
        <SerpSkeleton />
      </div>
    );
  }
  if (!captured) {
    return (
      <div className="-mx-4">
        <SerpNeverChecked />
      </div>
    );
  }
  return (
    <CapturedResults
      snapshot={captured}
      viewer={viewer}
      keyword={keyword}
      onOpenAll={onOpenAll}
    />
  );
}

export function KeywordSheetListing({
  appId,
  keywordId,
}: {
  appId: string;
  keywordId: string;
}) {
  const read = useQuery(keywordBreakdownOptions(appId, keywordId));
  const t = useTranslations("keywordInspector");
  const own = read.data?.apps.find((app) => app.isYou);
  if (read.data && !own) return null;

  return (
    <SheetSection title={t("keywordSheet.listing.title")}>
      {failedRead(read) ? (
        <InlineQueryError
          message={t("keywordSheet.listing.loadFailed")}
          read={read}
        />
      ) : null}
      {!read.data && !failedRead(read) ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : null}
      {read.data && own ? (
        <ul className="flex flex-col">
          <BreakdownAppCard appId={appId} app={own} breakdown={read.data} />
        </ul>
      ) : null}
    </SheetSection>
  );
}
