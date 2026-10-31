"use client";

import { useState, type ReactNode } from "react";
import {
  keepPreviousData,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  SERP_DEPTH,
  type SerpEntryItem,
  type SerpSnapshot,
  type Store,
  type TrackedKeywordItem,
} from "@asobeast/shared";
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
import { appDetailOptions, serpOptions } from "@/lib/queries";
import type { SerpRole, SerpViewer } from "./serp-csv";
import { isNewestDay, serpSummary } from "./serp-summary";
import { SerpExits } from "./SerpExits";
import { SerpHeader } from "./SerpHeader";
import { SerpList } from "./SerpList";
import { SerpRowActions } from "./SerpRowActions";
import {
  SerpKeptShort,
  SerpNeverChecked,
  SerpNoApps,
  SerpNothingCaptured,
  SerpSkeleton,
} from "./SerpStates";
import { SerpSummary } from "./SerpSummary";
import { useSerpParams } from "./use-serp-params";

type ActionsFor = (entry: SerpEntryItem, role: SerpRole) => ReactNode;

function useSerpApp(appId: string) {
  const { data } = useQuery(appDetailOptions(appId));
  const viewer: SerpViewer = { appId, storeAppId: data?.storeAppId };
  return { viewer, homeCountry: data?.country };
}

type CapturedSerp = SerpSnapshot & { date: string };

const isCaptured = (
  snapshot: SerpSnapshot | undefined,
): snapshot is CapturedSerp => typeof snapshot?.date === "string";

function SerpResults({
  snapshot,
  viewer,
  keyword,
  actionsFor,
}: {
  snapshot: CapturedSerp;
  viewer: SerpViewer;
  keyword: TrackedKeywordItem | undefined;
  actionsFor: ActionsFor | undefined;
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
          actionsFor={actionsFor}
        />
      ) : null}
      {deeper.length > 0 ? (
        <SerpList
          heading={`Positions ${SERP_DEPTH + 1} to ${deeper.at(-1)?.position}`}
          entries={deeper}
          viewer={viewer}
          comparedTo={comparedTo}
          actionsFor={actionsFor}
        />
      ) : null}
      {keptShort ? <SerpKeptShort /> : null}
      {comparedTo && exits.length > 0 ? (
        <SerpExits exits={exits} comparedTo={comparedTo} viewer={viewer} />
      ) : null}
    </div>
  );
}

function SerpBody({
  appId,
  keywordId,
  serpDate,
  store,
  keyword,
  onSelectDay,
}: {
  appId: string;
  keywordId: string;
  serpDate: string | null;
  store: Store;
  keyword: TrackedKeywordItem | undefined;
  onSelectDay: (date: string, newest: string | undefined) => void;
}) {
  const serp = useQuery({
    ...serpOptions(keywordId, serpDate),
    placeholderData: keepPreviousData,
  });
  const { viewer, homeCountry } = useSerpApp(appId);
  const snapshot = serp.data?.keywordId === keywordId ? serp.data : undefined;
  const country = keyword?.country ?? homeCountry;
  const actionsFor: ActionsFor | undefined = country
    ? (entry, role) => (
        <SerpRowActions
          appId={appId}
          store={store}
          country={country}
          entry={entry}
          role={role}
        />
      )
    : undefined;

  return (
    <>
      <SerpHeader
        text={snapshot?.text ?? keyword?.text}
        country={keyword?.country}
        store={store}
        snapshot={snapshot}
        loading={!snapshot && !failedRead(serp)}
        viewer={viewer}
        exportable={!serp.isPlaceholderData}
        onSelectDay={(date) => onSelectDay(date, snapshot?.dates?.[0])}
      />
      <SerpContent
        read={serp}
        snapshot={snapshot}
        busy={serp.isPlaceholderData}
        viewer={viewer}
        keyword={keyword}
        actionsFor={actionsFor}
      />
    </>
  );
}

function SerpContent({
  read,
  snapshot,
  busy,
  viewer,
  keyword,
  actionsFor,
}: {
  read: UseQueryResult<SerpSnapshot>;
  snapshot: SerpSnapshot | undefined;
  busy: boolean;
  viewer: SerpViewer;
  keyword: TrackedKeywordItem | undefined;
  actionsFor: ActionsFor | undefined;
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
  if (!snapshot) {
    return (
      <div role="status">
        <span className="sr-only">Loading search results</span>
        <SerpSkeleton />
      </div>
    );
  }
  if (!isCaptured(snapshot)) return <SerpNeverChecked />;
  return (
    <div aria-busy={busy || undefined}>
      <SerpResults
        snapshot={snapshot}
        viewer={viewer}
        keyword={keyword}
        actionsFor={actionsFor}
      />
    </div>
  );
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
  const [{ serp: keywordId, serpDate }, setSerpState] = useSerpParams();
  const [shownId, setShownId] = useState(keywordId);
  if (keywordId !== "" && keywordId !== shownId) setShownId(keywordId);
  const open = keywordId.length > 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) void setSerpState({ serp: "", serpDate: null });
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
            serpDate={serpDate}
            store={store}
            keyword={keyword}
            onSelectDay={(date, newest) =>
              void setSerpState({ serpDate: date === newest ? null : date })
            }
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
