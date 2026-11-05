"use client";

import { Clock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  staleCheckLabel,
  staleCheckLine,
} from "@/components/keywords/stale-check";

export function StaleClock({ day }: { day: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          tabIndex={0}
          aria-label={staleCheckLabel(day)}
          className="inline-flex rounded-sm text-muted-foreground"
        >
          <Clock aria-hidden className="size-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{staleCheckLine(day)}</TooltipContent>
    </Tooltip>
  );
}
