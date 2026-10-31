"use client";

import { useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import {
  SERP_DEPTH,
  type SerpSnapshot,
  type Store,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDate } from "@/lib/format";
import { appDetailOptions, serpOptions } from "@/lib/queries";
import { serpParser } from "@/lib/search-params";
import { exportSerp, type SerpViewer } from "./serp-csv";
import { isNewestDay, serpSummary } from "./serp-summary";
import { SerpExits } from "./SerpExits";
import { comparisonCaption, SerpHeader } from "./SerpHeader";
import { SerpList } from "./SerpList";
import {
  SerpKeptShort,
  SerpNeverChecked,
  SerpNoApps,
  SerpNothingCaptured,
  SerpSkeleton,
} from "./SerpStates";
import { SerpSummary } from "./SerpSummary";

function useSerpViewer(appId: string): SerpViewer {
  const { data } = useQuery(appDetailOptions(appId));
  return { appId, storeAppId: data?.storeAppId };
}

function SerpResults({
  snapshot,
  viewer,
  keyword,
}: {
  snapshot: CapturedSerp;
  viewer: SerpViewer;
  keyword: TrackedKeywordItem | undefined;
}) {
  const { entries, date } = snapshot;
  const comparedTo = snapshot.comparedTo ?? null;
  if (entries.length === 0) {
    return snapshot.dates && !snapshot.dates.includes(date) ? (
      <SerpNothingCaptured date={date} />
    ) : (
      <SerpNoApps date={date} />
    );
  }
  const topTen = entries.filter((entry) => entry.position <= SERP_DEPTH);
  const deeper = entries.filter((entry) => entry.position > SERP_DEPTH);
  const keptShort = !isNewestDay(snapshot) && entries.length === SERP_DEPTH;
  const exits = snapshot.exits ?? [];

  return (
    <div className="flex flex-col pb-6">
      <SerpSummary
        facts={serpSummary(snapshot, viewer, keyword)}
        comparedTo={comparedTo}
      />
      {topTen.length > 0 ? (
        <SerpList
          heading="Top 10"
          entries={topTen}
          viewer={viewer}
          comparedTo={comparedTo}
        />
      ) : null}
      {deeper.length > 0 ? (
        <SerpList
          heading={`Positions ${SERP_DEPTH + 1} to ${deeper.at(-1)?.position}`}
          entries={deeper}
          viewer={viewer}
          comparedTo={comparedTo}
        />
      ) : null}
      {keptShort ? <SerpKeptShort /> : null}
      {comparedTo && exits.length > 0 ? (
        <SerpExits exits={exits} comparedTo={comparedTo} viewer={viewer} />
      ) : null}
    </div>
  );
}

type CapturedSerp = SerpSnapshot & { date: string };

const isCaptured = (
  snapshot: SerpSnapshot | undefined,
): snapshot is CapturedSerp => typeof snapshot?.date === "string";

function SerpToolbar({
  snapshot,
  viewer,
}: {
  snapshot: SerpSnapshot | undefined;
  viewer: SerpViewer;
}) {
  return (
    <>
      {isCaptured(snapshot) ? (
        <>
          <span className="text-sm font-medium">
            {formatDate(snapshot.date)}
          </span>
          <span className="text-caption text-muted-foreground">
            {comparisonCaption(snapshot.comparedTo)}
          </span>
        </>
      ) : null}
      <ExportCsvButton
        subject="the search results"
        className="ml-auto"
        disabled={
          !snapshot ||
          snapshot.entries.length === 0 ||
          viewer.storeAppId === undefined
        }
        onClick={() => {
          if (snapshot) exportSerp(viewer, snapshot);
        }}
      />
    </>
  );
}

function SerpBody({
  appId,
  keywordId,
  store,
  keyword,
}: {
  appId: string;
  keywordId: string;
  store: Store;
  keyword: TrackedKeywordItem | undefined;
}) {
  const serp = useQuery(serpOptions(keywordId));
  const viewer = useSerpViewer(appId);
  const snapshot = serp.data;

  return (
    <>
      <SerpHeader
        text={snapshot?.text ?? keyword?.text}
        country={keyword?.country}
        store={store}
        toolbar={<SerpToolbar snapshot={snapshot} viewer={viewer} />}
      />
      <SerpContent read={serp} viewer={viewer} keyword={keyword} />
    </>
  );
}

function SerpContent({
  read,
  viewer,
  keyword,
}: {
  read: UseQueryResult<SerpSnapshot>;
  viewer: SerpViewer;
  keyword: TrackedKeywordItem | undefined;
}) {
  if (failedRead(read)) {
    return (
      <div className="px-4 pt-4">
        <InlineQueryError
          message="The search results could not be loaded."
          read={read}
        />
      </div>
    );
  }
  if (!read.data) {
    return (
      <div role="status">
        <span className="sr-only">Loading search results</span>
        <SerpSkeleton />
      </div>
    );
  }
  if (!isCaptured(read.data)) return <SerpNeverChecked />;
  return <SerpResults snapshot={read.data} viewer={viewer} keyword={keyword} />;
}

export function SerpSheet({
  appId,
  store,
  keyword,
}: {
  appId: string;
  store: Store;
  keyword?: TrackedKeywordItem;
}) {
  const [keywordId, setKeywordId] = useQueryState("serp", serpParser);
  const [shownId, setShownId] = useState(keywordId);
  if (keywordId !== "" && keywordId !== shownId) setShownId(keywordId);
  const open = keywordId.length > 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) void setKeywordId("");
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          const opener = document.querySelector<HTMLButtonElement>(
            `[data-serp-keyword="${CSS.escape(shownId)}"]`,
          );
          if (!opener) return;
          event.preventDefault();
          opener.focus();
        }}
      >
        <SheetHeader className="px-4 pt-4 pr-12">
          <SheetTitle>Search results</SheetTitle>
          <SheetDescription>
            The apps the store showed for this keyword on a daily check.
          </SheetDescription>
        </SheetHeader>
        {open ? (
          <SerpBody
            appId={appId}
            keywordId={keywordId}
            store={store}
            keyword={keyword}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
