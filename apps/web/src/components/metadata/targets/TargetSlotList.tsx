"use client";

import type { ListingTargetsResult } from "@asobeast/shared";
import {
  moveSlot,
  placementsByPhrase,
  scoresByPhrase,
  slotLabel,
  untrackedByPhrase,
  withSlot,
  type TargetSlots,
} from "@/lib/listing-targets";
import { cn } from "@/lib/utils";
import { TargetSlot } from "./TargetSlot";

export function TargetSlotList({
  label,
  indexes,
  slots,
  result,
  onEdit,
  onMoved,
  className,
}: {
  label: string;
  indexes: readonly number[];
  slots: TargetSlots;
  result: ListingTargetsResult;
  onEdit: (next: TargetSlots) => void;
  onMoved: (sentence: string, to: number) => void;
  className?: string;
}) {
  const scores = scoresByPhrase(result);
  const untracked = untrackedByPhrase(result);
  const placements = placementsByPhrase(result);
  return (
    <ul
      aria-label={label}
      className={cn(
        "grid list-none gap-1 p-0 @3xl/metadata:grid-cols-3",
        className,
      )}
    >
      {indexes.map((index) => {
        const value = slots[index];
        return (
          <TargetSlot
            key={index}
            index={index}
            slots={slots}
            candidates={result.candidates}
            scores={value === null ? undefined : scores.get(value)}
            placement={value === null ? undefined : placements.get(value)}
            untrackedIn={value === null ? [] : (untracked.get(value) ?? [])}
            onChange={(text) => onEdit(withSlot(slots, index, text))}
            onMove={(to) => {
              onEdit(moveSlot(slots, index, to));
              onMoved(`${value ?? ""} moved to ${slotLabel(to)}`, to);
            }}
          />
        );
      })}
    </ul>
  );
}
