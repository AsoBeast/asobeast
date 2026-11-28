"use client";

import { ChevronRight } from "lucide-react";
import { InlineQueryError } from "@/components/layout/InlineQueryError";
import { Button } from "@/components/ui/button";
import { TargetSlotList } from "./TargetSlotList";
import type { TargetEdits } from "./use-target-edits";

export const ROLE_SLOTS = [0, 1, 2] as const;
export const MORE_SLOTS = [3, 4, 5, 6, 7, 8, 9] as const;

export function TargetsBody({
  targets,
  showMore,
  onToggleMore,
  onMoved,
}: {
  targets: TargetEdits;
  showMore: boolean;
  onToggleMore: () => void;
  onMoved: (sentence: string, to: number) => void;
}) {
  const result = targets.read.data;
  if (!result && targets.read.isError) {
    return (
      <InlineQueryError
        message="Could not load the target keywords."
        read={targets.read}
      />
    );
  }
  if (!result) {
    return (
      <p className="text-dense text-muted-foreground">
        Reading the target keywords…
      </p>
    );
  }
  return (
    <>
      <TargetSlotList
        label="Title and subtitle"
        indexes={ROLE_SLOTS}
        slots={targets.slots}
        result={result}
        onEdit={targets.edit}
        onMoved={onMoved}
      />
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={showMore}
        className="-ml-2 w-fit"
        onClick={onToggleMore}
      >
        <ChevronRight
          aria-hidden
          className="transition-transform duration-150 ease-out data-[open=true]:rotate-90"
          data-open={showMore}
        />
        <span>{showMore ? "Show fewer slots" : "Show more slots"}</span>
      </Button>
      {showMore ? (
        <TargetSlotList
          label="More keywords"
          indexes={MORE_SLOTS}
          slots={targets.slots}
          result={result}
          onEdit={targets.edit}
          onMoved={onMoved}
        />
      ) : null}
    </>
  );
}
