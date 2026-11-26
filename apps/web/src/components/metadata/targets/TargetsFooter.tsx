"use client";

import type { RefObject } from "react";
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
}: {
  targets: TargetEdits;
  result: ListingTargetsResult | undefined;
  saveRef: RefObject<HTMLButtonElement | null>;
}) {
  const focusAfter = useFocusAfterCommit();
  const idle = !targets.edited || targets.saving;
  const missing = result && !targets.edited ? missingMarkets(result) : [];

  return (
    <CardFooter className="flex-wrap justify-between">
      <span>{result ? readersLine(result.readers) : ""}</span>
      <span className="flex flex-wrap gap-2">
        {missing.length > 0 ? (
          <Button
            variant="outline"
            aria-disabled={targets.saving || undefined}
            onClick={(event) => {
              if (targets.saving) return;
              focusAfter(saveRef.current, event.currentTarget);
              targets.save(true);
            }}
          >
            {marketCount(missing.length)}
          </Button>
        ) : null}
        <Button
          variant="outline"
          aria-disabled={idle || undefined}
          onClick={() => {
            if (!idle) targets.discard();
          }}
        >
          <RotateCcw aria-hidden />
          <span>Discard changes</span>
        </Button>
        <Button
          ref={saveRef}
          aria-disabled={idle || undefined}
          onClick={() => {
            if (!idle) targets.save();
          }}
        >
          Save targets
        </Button>
      </span>
    </CardFooter>
  );
}
