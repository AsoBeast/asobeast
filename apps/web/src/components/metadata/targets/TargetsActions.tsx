"use client";

import type { ListingTargetsResult } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  placementsByPhrase,
  topThreeRefusal,
  withTopThree,
  type TargetSlots,
} from "@/lib/listing-targets";
import { applyPlacements, applyRefusal } from "@/lib/target-placements";

function RefusableButton({
  refusal,
  onPress,
  children,
}: {
  refusal: string | null;
  onPress: () => void;
  children: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      aria-disabled={refusal !== null || undefined}
      title={refusal ?? undefined}
      onClick={() => {
        if (refusal === null) onPress();
      }}
    >
      <span>{children}</span>
    </Button>
  );
}

export function TargetsActions({
  slots,
  result,
  onEdit,
  onApplied,
  onFocusSave,
}: {
  slots: TargetSlots;
  result: ListingTargetsResult;
  onEdit: (next: TargetSlots) => void;
  onApplied: (sentence: string) => void;
  onFocusSave: () => void;
}) {
  const placements = placementsByPhrase(result);
  return (
    <>
      <RefusableButton
        refusal={topThreeRefusal(slots, result.candidates)}
        onPress={() => {
          onEdit(withTopThree(slots, result.candidates));
          onFocusSave();
        }}
      >
        Use top 3
      </RefusableButton>
      <RefusableButton
        refusal={applyRefusal(slots, placements)}
        onPress={() => {
          onEdit(applyPlacements(slots, placements));
          onApplied("Targets reordered to match the suggestions");
          onFocusSave();
        }}
      >
        Apply suggestions
      </RefusableButton>
    </>
  );
}
