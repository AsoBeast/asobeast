"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";
import {
  formatCheckedPosition,
  type Store,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCountry, storeLabel } from "@/lib/format";
import { isChecking, staleCheckDay } from "@/lib/keyword-checks";
import type { RangePreset } from "@/lib/ranges";
import { KeywordClassTag } from "../KeywordClassTag";
import { KeywordRowActions } from "../KeywordRowActions";
import { PositionHistoryPanel } from "../PositionHistoryPanel";
import { PositionHistoryNotes } from "../PositionHistoryPopover";
import { NO_STEPS, type KeywordSteps } from "./keyword-steps";
import {
  KeywordSheetFacts,
  KeywordSheetInsights,
  KeywordSheetNotes,
  KeywordSheetScores,
} from "./KeywordSheetSections";
import { KeywordSheetListing, KeywordSheetResults } from "./KeywordSheetReads";
import { SheetSection } from "./SheetSection";

const openerOf = (keywordId: string | null): HTMLElement | null =>
  keywordId === null
    ? null
    : document.querySelector<HTMLElement>(
        `[data-keyword-sheet="${CSS.escape(keywordId)}"]`,
      );

interface Shown {
  keywordId: string;
  steps: KeywordSteps;
}

const closeTarget = (shown: Shown): HTMLElement | null =>
  openerOf(shown.keywordId) ??
  openerOf(shown.steps.next) ??
  openerOf(shown.steps.previous) ??
  document.querySelector<HTMLElement>("[data-keyword-sheet]");

function StepButton({
  label,
  icon: Icon,
  target,
  onStep,
}: {
  label: string;
  icon: LucideIcon;
  target: string | null;
  onStep: (keywordId: string) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-disabled={target === null || undefined}
      className="text-muted-foreground hover:text-foreground"
      onClick={() => {
        if (target !== null) onStep(target);
      }}
    >
      <Icon aria-hidden />
    </Button>
  );
}

function PositionHistorySection({
  appId,
  store,
  homeCountry,
  keyword,
  today,
}: {
  appId: string;
  store: Store;
  homeCountry: string;
  keyword: TrackedKeywordItem;
  today: string;
}) {
  const [range, setRange] = useState<RangePreset>("30d");
  return (
    <SheetSection title="Position history">
      {isChecking(keyword) ? (
        <p className="text-muted-foreground">
          The first check is queued. The chart appears once it lands.
        </p>
      ) : (
        <>
          <PositionHistoryNotes
            keyword={keyword}
            staleOn={staleCheckDay(keyword, today)}
          />
          <PositionHistoryPanel
            appId={appId}
            store={store}
            keyword={keyword}
            homeCountry={homeCountry}
            range={range}
            onRange={setRange}
          />
        </>
      )}
    </SheetSection>
  );
}

function KeywordSheetBody({
  appId,
  store,
  homeCountry,
  keyword,
  today,
  marketTags,
  steps,
  onStep,
  onOpenSerp,
}: {
  appId: string;
  store: Store;
  homeCountry: string;
  keyword: TrackedKeywordItem;
  today: string;
  marketTags: () => string[];
  steps: KeywordSteps;
  onStep: (keywordId: string) => void;
  onOpenSerp: () => void;
}) {
  return (
    <>
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
        <div className="flex shrink-0 items-center">
          <StepButton
            label="Previous keyword"
            icon={ChevronUp}
            target={steps.previous}
            onStep={onStep}
          />
          <StepButton
            label="Next keyword"
            icon={ChevronDown}
            target={steps.next}
            onStep={onStep}
          />
          <KeywordRowActions
            key={keyword.keywordId}
            appId={appId}
            keyword={keyword}
            marketTags={marketTags}
            onOpenSerp={onOpenSerp}
          />
        </div>
      </SheetHeader>
      <KeywordSheetFacts keyword={keyword} today={today} />
      <div
        key={keyword.keywordId}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-6"
      >
        <KeywordSheetInsights keyword={keyword} today={today} />
        <PositionHistorySection
          appId={appId}
          store={store}
          homeCountry={homeCountry}
          keyword={keyword}
          today={today}
        />
        <KeywordSheetResults
          appId={appId}
          keyword={keyword}
          onOpenAll={onOpenSerp}
        />
        <KeywordSheetScores keyword={keyword} />
        <KeywordSheetListing appId={appId} keywordId={keyword.keywordId} />
        <KeywordSheetNotes
          appId={appId}
          keyword={keyword}
          marketTags={marketTags}
        />
      </div>
    </>
  );
}

export function KeywordSheet({
  appId,
  store,
  homeCountry,
  keyword,
  today,
  marketTags,
  steps,
  onStep,
  onClose,
  onOpenSerp,
}: {
  appId: string;
  store: Store;
  homeCountry: string;
  keyword: TrackedKeywordItem | undefined;
  today: string;
  marketTags: () => string[];
  steps: KeywordSteps;
  onStep: (keywordId: string) => void;
  onClose: () => void;
  onOpenSerp: (keywordId: string) => void;
}) {
  const [shown, setShown] = useState<Shown>({
    keywordId: keyword?.keywordId ?? "",
    steps: NO_STEPS,
  });
  if (
    keyword &&
    (keyword.keywordId !== shown.keywordId ||
      steps.previous !== shown.steps.previous ||
      steps.next !== shown.steps.next)
  ) {
    setShown({ keywordId: keyword.keywordId, steps });
  }

  return (
    <Sheet
      open={keyword !== undefined}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          const opener = closeTarget(shown);
          if (!opener) return;
          event.preventDefault();
          opener.focus();
        }}
      >
        {keyword ? (
          <KeywordSheetBody
            appId={appId}
            store={store}
            homeCountry={homeCountry}
            keyword={keyword}
            today={today}
            marketTags={marketTags}
            steps={steps}
            onStep={onStep}
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
