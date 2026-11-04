"use client";

import { useId, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  parseThresholdInput,
  ZONE_THRESHOLD_MAX,
  ZONE_THRESHOLD_MIN,
  zoneRule,
  type ZoneThresholds,
} from "@/lib/keyword-zones";
import { useZoneThresholds } from "../use-zone-thresholds";

const INVALID_THRESHOLD = `Enter a whole number from ${ZONE_THRESHOLD_MIN} to ${ZONE_THRESHOLD_MAX}`;

function ThresholdField({
  label,
  value,
  onValid,
}: {
  label: string;
  value: number;
  onValid: (next: number) => void;
}) {
  const id = useId();
  const errorId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && parseThresholdInput(draft) === null;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={ZONE_THRESHOLD_MIN}
        max={ZONE_THRESHOLD_MAX}
        step={1}
        value={draft ?? String(value)}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(event) => {
          setDraft(event.target.value);
          const next = parseThresholdInput(event.target.value);
          if (next !== null) onValid(next);
        }}
        onBlur={() => setDraft(null)}
      />
      {invalid ? (
        <p id={errorId} role="alert" className="text-caption text-destructive">
          {INVALID_THRESHOLD}
        </p>
      ) : null}
    </div>
  );
}

export function ThresholdsPopover() {
  const titleId = useId();
  const { thresholds, setThresholds, resetThresholds, isDefault } =
    useZoneThresholds();
  const update = (field: keyof ZoneThresholds) => (next: number) =>
    setThresholds({ ...thresholds, [field]: next });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="print:hidden">
          <SlidersHorizontal aria-hidden />
          <span>Thresholds</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-labelledby={titleId}
        align="end"
        collisionPadding={16}
        className="flex w-80 max-w-(--radix-popover-content-available-width) flex-col gap-3 text-body"
      >
        <PopoverHeader>
          <PopoverTitle id={titleId}>Zone thresholds</PopoverTitle>
          <PopoverDescription>
            The two numbers that cut the map into zones. Kept in this browser.
          </PopoverDescription>
        </PopoverHeader>
        <ThresholdField
          label="Popularity at least"
          value={thresholds.popularity}
          onValid={update("popularity")}
        />
        <ThresholdField
          label="Difficulty at most"
          value={thresholds.difficulty}
          onValid={update("difficulty")}
        />
        <p className="text-caption text-muted-foreground">
          {`Quick wins are ${zoneRule("quickWins", thresholds).toLowerCase()}.`}
        </p>
        <Button
          variant="outline"
          size="sm"
          aria-disabled={isDefault || undefined}
          onClick={() => {
            if (!isDefault) resetThresholds();
          }}
          className="self-start"
        >
          Reset
        </Button>
      </PopoverContent>
    </Popover>
  );
}
