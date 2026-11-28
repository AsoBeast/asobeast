"use client";

import type { Ref } from "react";
import { RotateCcw } from "lucide-react";
import type { ListingTargetsResult } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { useFocusAfterCommit } from "@/lib/focus-handoff";
import { missingMarkets, readersLine } from "@/lib/listing-targets";
import type { TargetEdits } from "./use-target-edits";

const marketCount = (count: number) =>
  `Track in ${count} ${count === 1 ? "market" : "markets"}`;

export function TargetsFooter({
  targets,
  result,
  saveRef,
  firstSlot,
  onDone,
}: {
  targets: TargetEdits;
  result: ListingTargetsResult | undefined;
  saveRef: Ref<HTMLButtonElement>;
  firstSlot: () => HTMLElement | null;
  onDone: (() => void) | undefined;
}) {
  const focusAfter = useFocusAfterCommit();
  const missing = result && !targets.edited ? missingMarkets(result) : [];
  if (!targets.edited && !onDone && missing.length === 0) return null;

  return (
    <CardFooter className="flex-wrap justify-between">
      <span>{result ? readersLine(result.readers) : ""}</span>
      <span className="flex flex-wrap gap-2">
        {missing.length > 0 ? (
          <Button
            variant="outline"
            aria-disabled={targets.saving || undefined}
            onClick={() => {
              if (!targets.saving) targets.save(true);
            }}
          >
            {marketCount(missing.length)}
          </Button>
        ) : null}
        {onDone ? (
          <Button variant="outline" onClick={onDone}>
            <span>Done</span>
          </Button>
        ) : null}
        {targets.edited ? (
          <>
            <Button
              variant="outline"
              aria-disabled={targets.saving || undefined}
              onClick={(event) => {
                if (targets.saving) return;
                focusAfter(firstSlot(), event.currentTarget);
                targets.discard();
              }}
            >
              <RotateCcw aria-hidden />
              <span>Discard changes</span>
            </Button>
            <Button
              ref={saveRef}
              aria-disabled={targets.saving || undefined}
              onClick={() => {
                if (!targets.saving) targets.save();
              }}
            >
              Save targets
            </Button>
          </>
        ) : null}
      </span>
    </CardFooter>
  );
}
