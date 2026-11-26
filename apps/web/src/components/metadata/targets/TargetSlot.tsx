"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import type { ListingTargetCandidate, TargetScores } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { useFocusAfterCommit } from "@/lib/focus-handoff";
import { slotLabel, type TargetSlots } from "@/lib/listing-targets";
import { TargetFigures } from "./TargetFigures";
import { TargetSlotPicker } from "./TargetSlotPicker";

export function TargetSlot({
  index,
  slots,
  candidates,
  scores,
  onChange,
}: {
  index: number;
  slots: TargetSlots;
  candidates: readonly ListingTargetCandidate[];
  scores: TargetScores | undefined;
  onChange: (text: string | null) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const focusAfter = useFocusAfterCommit();
  const value = slots[index];
  const label = slotLabel(index);

  return (
    <li
      aria-label={label}
      className="flex min-w-0 flex-col gap-1.5 rounded-md p-2"
    >
      <span className="text-label text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-1">
        <TargetSlotPicker
          ref={trigger}
          index={index}
          value={value}
          slots={slots}
          candidates={candidates}
          onPick={onChange}
        />
        {value === null ? null : (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${value} from ${label}`}
            onClick={(event) => {
              focusAfter(trigger.current, event.currentTarget);
              onChange(null);
            }}
          >
            <X aria-hidden />
          </Button>
        )}
      </div>
      <div className="min-h-5">
        {value !== null && scores ? <TargetFigures scores={scores} /> : null}
      </div>
    </li>
  );
}
