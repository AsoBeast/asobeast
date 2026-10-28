"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChartLine, History } from "lucide-react";
import {
  formatCheckedPosition,
  keywordLabel,
  type Store,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RangePicker } from "@/components/rankings/RangePicker";
import { formatCountry, storeLabel } from "@/lib/format";
import { RANGE_PRESETS, type RangePreset } from "@/lib/ranges";
import { positionHoldFacts } from "./position-hold";
import { rankingsHistoryHref } from "./position-history";
import { PositionHistoryPanel } from "./PositionHistoryPanel";
import { PositionReadout } from "./PositionReadout";
import { staleCheckLabel, staleCheckLine } from "./stale-check";

export interface PositionHistoryContext {
  appId: string;
  store: Store;
  homeCountry: string;
  multiMarket: boolean;
}

interface PositionHistoryProps extends PositionHistoryContext {
  keyword: TrackedKeywordItem;
  staleOn: string | null;
}

function HoldFacts({ keyword }: { keyword: TrackedKeywordItem }) {
  const facts = positionHoldFacts(keyword);
  if (facts.length === 0) return null;
  return (
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(6rem,1fr))] gap-2">
      {facts.map((fact) => (
        <div key={fact.label} className="rounded-md border px-2 py-1.5">
          <dt className="text-caption text-muted-foreground">{fact.label}</dt>
          <dd className="text-body font-medium">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PositionHistoryContent({
  keyword,
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
          <p id={ids.eyebrow} className="text-caption text-muted-foreground">
            Position history
          </p>
          <PopoverTitle id={ids.title} className="wrap-anywhere">
            {keyword.text}
          </PopoverTitle>
          <PopoverDescription id={ids.market}>
            {storeLabel(store)} · {formatCountry(keyword.country)}
          </PopoverDescription>
        </PopoverHeader>
        <PositionReadout
          keyword={keyword}
          label={
            formatCheckedPosition(
              keyword.latestPosition,
              keyword.latestDepth,
            ) ?? ""
          }
          staleOn={staleOn}
          className="text-title"
        />
      </div>
      {staleOn === null ? null : (
        <p className="flex gap-1.5 text-caption text-muted-foreground">
          <History aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {staleCheckLine(staleOn)}
        </p>
      )}
      <HoldFacts keyword={keyword} />
      <RangePicker
        presets={RANGE_PRESETS}
        value={range}
        onChange={setRange}
        label="Date range"
      />
      <PositionHistoryPanel
        appId={appId}
        keyword={keyword}
        homeCountry={homeCountry}
        range={range}
        onRange={setRange}
      />
      <Button asChild variant="link" size="sm" className="self-start px-0">
        <Link href={rankingsHistoryHref(appId, keyword.keywordId, range)}>
          Open in Rankings
        </Link>
      </Button>
    </>
  );
}

export function PositionHistoryPopover(props: PositionHistoryProps) {
  const { keyword, staleOn, multiMarket } = props;
  const ids = { eyebrow: useId(), title: useId(), market: useId() };
  const name = `Position history: ${multiMarket ? keywordLabel(keyword) : keyword.text}`;
  const Icon = staleOn === null ? ChartLine : History;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={
            staleOn === null ? name : `${name}, ${staleCheckLabel(staleOn)}`
          }
          className="-my-1 text-muted-foreground hover:text-foreground print:hidden"
        >
          <Icon aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        aria-labelledby={`${ids.eyebrow} ${ids.title}`}
        aria-describedby={ids.market}
        className="max-h-(--radix-popover-content-available-height) w-md max-w-(--radix-popover-content-available-width) gap-3 overflow-y-auto p-3"
      >
        <PositionHistoryContent {...props} ids={ids} />
      </PopoverContent>
    </Popover>
  );
}
