"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { History } from "lucide-react";
import {
  keywordLabel,
  type Store,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatCountry, storeLabel } from "@/lib/format";
import { lostPosition } from "@/lib/keyword-checks";
import type { RangePreset } from "@/lib/ranges";
import { cn } from "@/lib/utils";
import { positionHoldFacts } from "./position-hold";
import { PositionHistoryPanel } from "./PositionHistoryPanel";
import { lastRankedLine, PositionReadout } from "./PositionReadout";
import { ROW_PEEK } from "./row-peek";
import { staleCheckLabel, staleCheckLine } from "./stale-check";

export interface PositionHistoryContext {
  appId: string;
  store: Store;
  homeCountry: string;
  multiMarket: boolean;
}

export interface PositionHistoryProps extends PositionHistoryContext {
  keyword: TrackedKeywordItem;
  label: string;
  staleOn: string | null;
}

function LostDay({ keyword }: { keyword: TrackedKeywordItem }) {
  const lost = lostPosition(keyword);
  if (!lost?.on) return null;
  return (
    <p className="text-caption text-muted-foreground">
      {lastRankedLine(lost.position, lost.on)}
    </p>
  );
}

function HoldFacts({ keyword }: { keyword: TrackedKeywordItem }) {
  const facts = positionHoldFacts(keyword);
  if (facts.length === 0) return null;
  return (
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(6rem,1fr))] gap-2">
      {facts.map((fact) => (
        <div key={fact.label} className="rounded-md border px-2 py-1">
          <dt className="text-caption text-muted-foreground">{fact.label}</dt>
          <dd className="text-body font-medium">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PositionHistoryNotes({
  keyword,
  staleOn,
}: {
  keyword: TrackedKeywordItem;
  staleOn: string | null;
}) {
  return (
    <>
      {staleOn === null ? null : (
        <p className="flex gap-1.5 text-caption text-muted-foreground">
          <History aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>{staleCheckLine(staleOn)}</span>
        </p>
      )}
      <LostDay keyword={keyword} />
      <HoldFacts keyword={keyword} />
    </>
  );
}

function PositionHistoryContent({
  keyword,
  label,
  staleOn,
  appId,
  store,
  homeCountry,
  ids,
}: PositionHistoryProps & {
  ids: { eyebrow: string; title: string; market: string };
}) {
  const [range, setRange] = useState<RangePreset>("30d");
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PopoverHeader className="min-w-0">
          <PopoverTitle id={ids.title} className="wrap-anywhere">
            {keyword.text}
          </PopoverTitle>
          <PopoverDescription>
            <span id={ids.eyebrow}>Position history</span> ·{" "}
            <span id={ids.market}>
              {storeLabel(store)} · {formatCountry(keyword.country)}
            </span>
          </PopoverDescription>
        </PopoverHeader>
        <PositionReadout
          keyword={keyword}
          label={label}
          staleOn={staleOn}
          className="text-heading"
        />
      </div>
      <PositionHistoryNotes keyword={keyword} staleOn={staleOn} />
      <PositionHistoryPanel
        appId={appId}
        store={store}
        keyword={keyword}
        homeCountry={homeCountry}
        range={range}
        onRange={setRange}
      />
    </>
  );
}

export function PositionHistoryPopoverContent({
  onCloseAutoFocus,
  ...props
}: PositionHistoryProps & {
  onCloseAutoFocus?: ComponentProps<typeof PopoverContent>["onCloseAutoFocus"];
}) {
  const ids = { eyebrow: useId(), title: useId(), market: useId() };
  return (
    <PopoverContent
      align="end"
      collisionPadding={16}
      aria-labelledby={`${ids.eyebrow} ${ids.title}`}
      aria-describedby={ids.market}
      onCloseAutoFocus={onCloseAutoFocus}
      className="max-h-(--radix-popover-content-available-height) w-md max-w-(--radix-popover-content-available-width) gap-2.5 overflow-y-auto p-3"
    >
      <PositionHistoryContent {...props} ids={ids} />
    </PopoverContent>
  );
}

export function PositionHistoryPopover({
  children,
  ...props
}: PositionHistoryProps & { children: ReactNode }) {
  const { keyword, staleOn, multiMarket } = props;
  const summaryId = useId();
  const name = `Position history: ${multiMarket ? keywordLabel(keyword) : keyword.text}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            staleOn === null ? name : `${name}, ${staleCheckLabel(staleOn)}`
          }
          aria-describedby={summaryId}
          className={cn("inline-flex items-center", ROW_PEEK)}
        >
          <span id={summaryId} className="inline-flex items-center gap-2">
            {children}
          </span>
        </button>
      </PopoverTrigger>
      <PositionHistoryPopoverContent {...props} />
    </Popover>
  );
}
