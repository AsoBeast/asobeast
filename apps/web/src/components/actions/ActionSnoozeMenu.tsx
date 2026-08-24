"use client";

import { Clock } from "lucide-react";
import type { ActionStatus } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";

export const SNOOZE_PRESET_DAYS = [7, 14, 30] as const;
export const SNOOZE_MAX_DAYS = 90;

const DAY_MS = 86_400_000;

export function snoozeUntil(days: number, now = Date.now()): string {
  const bounded = Math.min(days, SNOOZE_MAX_DAYS);
  return new Date(now + bounded * DAY_MS).toISOString();
}

export function ActionSnoozeMenu({
  status,
  snoozedUntil,
  disabled,
  onSnooze,
  onWake,
}: {
  status: ActionStatus;
  snoozedUntil: string | null;
  disabled: boolean;
  onSnooze: (snoozedUntil: string) => void;
  onWake: () => void;
}) {
  if (status === "SNOOZED") {
    return (
      <Button variant="outline" size="sm" disabled={disabled} onClick={onWake}>
        <Clock aria-hidden className="size-4" />
        {snoozedUntil ? `Wakes ${formatDate(snoozedUntil)}` : "Wake now"}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Clock aria-hidden className="size-4" />
          Snooze
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SNOOZE_PRESET_DAYS.map((days) => (
          <DropdownMenuItem
            key={days}
            onSelect={() => onSnooze(snoozeUntil(days))}
          >
            {days} days
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
