"use client";

import { useState } from "react";
import { useQueryState } from "nuqs";
import type { Store, TrackedKeywordItem } from "@asobeast/shared";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCountry, storeLabel } from "@/lib/format";
import type { RangePreset } from "@/lib/ranges";
import { keywordSheetParser } from "@/lib/search-params";
import { KeywordClassTag } from "../KeywordClassTag";
import { KeywordRowActions } from "../KeywordRowActions";
import { PositionHistoryPanel } from "../PositionHistoryPanel";
import {
  KeywordSheetFacts,
  KeywordSheetInsights,
  KeywordSheetNotes,
  KeywordSheetScores,
} from "./KeywordSheetFacts";
import { KeywordSheetListing, KeywordSheetResults } from "./KeywordSheetReads";
import { SheetSection } from "./SheetSection";

export const KEYWORD_SHEET_KEY = "keyword";

export const useKeywordSheet = () =>
  useQueryState(KEYWORD_SHEET_KEY, keywordSheetParser);

const openerOf = (keywordId: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(
    `[data-keyword-sheet="${CSS.escape(keywordId)}"]`,
  ) ?? document.querySelector<HTMLElement>("[data-keyword-sheet]");

function KeywordSheetBody({
  appId,
  store,
  homeCountry,
  keyword,
  today,
  marketTags,
  onOpenSerp,
}: {
  appId: string;
  store: Store;
  homeCountry: string;
  keyword: TrackedKeywordItem;
  today: string;
  marketTags: () => string[];
  onOpenSerp: () => void;
}) {
  const [range, setRange] = useState<RangePreset>("30d");
  return (
    <div className="flex flex-col overflow-y-auto pb-6">
      <SheetHeader className="flex-row items-start justify-between gap-3 px-4 pt-4 pr-12">
        <div className="flex min-w-0 flex-col gap-1">
          <SheetTitle className="flex items-center gap-2">
            <span dir="auto" className="wrap-anywhere">
              {keyword.text}
            </span>
            <KeywordClassTag
              keywordClass={keyword.keywordClass}
              source={keyword.keywordClassSource}
            />
          </SheetTitle>
          <SheetDescription>
            {`${storeLabel(store)} · ${formatCountry(keyword.country)}${keyword.active ? "" : " · Paused"}`}
          </SheetDescription>
        </div>
        <KeywordRowActions
          appId={appId}
          keyword={keyword}
          marketTags={marketTags}
          onOpenSerp={onOpenSerp}
        />
      </SheetHeader>
      <KeywordSheetFacts keyword={keyword} today={today} />
      <KeywordSheetInsights keyword={keyword} today={today} />
      <SheetSection title="Position history">
        <PositionHistoryPanel
          appId={appId}
          store={store}
          keyword={keyword}
          homeCountry={homeCountry}
          range={range}
          onRange={setRange}
        />
      </SheetSection>
      <KeywordSheetResults
        appId={appId}
        keyword={keyword}
        onOpenAll={onOpenSerp}
      />
      <KeywordSheetListing appId={appId} keywordId={keyword.keywordId} />
      <KeywordSheetScores keyword={keyword} />
      <KeywordSheetNotes keyword={keyword} />
    </div>
  );
}

export function KeywordSheet({
  appId,
  store,
  homeCountry,
  keyword,
  today,
  marketTags,
  onOpenSerp,
}: {
  appId: string;
  store: Store;
  homeCountry: string;
  keyword: TrackedKeywordItem | undefined;
  today: string;
  marketTags: () => string[];
  onOpenSerp: (keywordId: string) => void;
}) {
  const [, setSheet] = useKeywordSheet();
  const [shownId, setShownId] = useState(keyword?.keywordId ?? "");
  if (keyword && keyword.keywordId !== shownId) setShownId(keyword.keywordId);

  return (
    <Sheet
      open={keyword !== undefined}
      onOpenChange={(next) => {
        if (!next) void setSheet("");
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          const opener = openerOf(shownId);
          if (!opener) return;
          event.preventDefault();
          opener.focus();
        }}
      >
        {keyword ? (
          <KeywordSheetBody
            key={keyword.keywordId}
            appId={appId}
            store={store}
            homeCountry={homeCountry}
            keyword={keyword}
            today={today}
            marketTags={marketTags}
            onOpenSerp={() => onOpenSerp(keyword.keywordId)}
          />
        ) : (
          <SheetHeader className="sr-only">
            <SheetTitle>Keyword</SheetTitle>
            <SheetDescription>Details of one tracked keyword.</SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}
