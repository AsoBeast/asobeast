"use client";

import { useId } from "react";
import { Check, Minus } from "lucide-react";
import type { CoveragePreviewTarget } from "@asobeast/shared";
import { LIST_HEAD } from "@/components/layout/panel-classes";
import { slotLabel } from "@/lib/listing-targets";
import { cn } from "@/lib/utils";

const changeLine = (target: CoveragePreviewTarget): string | null => {
  if (target.live.covered === target.draft.covered) return null;
  return target.live.covered ? "Was covered" : "Newly covered";
};

function Verdict({ covered }: { covered: boolean }) {
  const Mark = covered ? Check : Minus;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-caption font-medium",
        covered ? "text-signal-up" : "text-signal-down",
      )}
    >
      <Mark aria-hidden className="size-3.5" />
      <span>{covered ? "Covered" : "Not covered"}</span>
    </span>
  );
}

export function DraftTargetList({
  targets,
}: {
  targets: readonly CoveragePreviewTarget[];
}) {
  const headingId = useId();
  if (targets.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 border-t border-border-subtle px-2 pt-3 first:border-t-0 first:pt-0">
      <h3 id={headingId} className={LIST_HEAD}>
        <span className="text-foreground">Targets</span>
      </h3>
      <ul aria-labelledby={headingId} className="flex list-none flex-col p-0">
        {targets.map((target) => {
          const change = changeLine(target);
          return (
            <li
              key={target.position}
              className="flex min-h-9 flex-wrap items-center justify-between gap-x-3 py-1 text-dense"
            >
              <span className="flex min-w-0 basis-40 grow items-baseline gap-2">
                <span
                  translate="no"
                  dir="auto"
                  title={target.text}
                  className="truncate font-medium"
                >
                  {target.text}
                </span>
                <span className="shrink-0 text-caption text-faint-foreground">
                  {slotLabel(target.position - 1)}
                </span>
              </span>
              <span className="ml-auto flex flex-col items-end">
                <Verdict covered={target.draft.covered} />
                {change ? (
                  <span className="text-caption text-faint-foreground">
                    {change}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
