"use client";

import { LoaderCircle } from "lucide-react";
import type { KeywordDiscoveryList } from "@asobeast/shared";
import {
  discoveryFooter,
  pendingChecksText,
  unfitNotice,
} from "@/lib/keyword-discoveries";
import { cn } from "@/lib/utils";

export function DiscoveryFooter({
  list,
  updatedAt,
}: {
  list: KeywordDiscoveryList;
  updatedAt: number;
}) {
  const pending = list.checks.pending > 0;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
      <p aria-live="polite">
        {discoveryFooter(list.checks, new Date(updatedAt))}
      </p>
      <p
        aria-live="polite"
        className={cn("inline-flex items-center gap-1.5", !pending && "hidden")}
      >
        <LoaderCircle
          aria-hidden
          className="size-3.5 motion-safe:animate-spin"
        />
        <span>{pendingChecksText(list.checks.pending)}</span>
      </p>
      {list.unfit > 0 ? (
        <p role="note" className="font-medium text-foreground">
          {unfitNotice(list.unfit)}
        </p>
      ) : null}
    </div>
  );
}
