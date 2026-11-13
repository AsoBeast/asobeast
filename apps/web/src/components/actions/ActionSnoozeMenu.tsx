"use client";

import { useCallback, useEffect, useRef } from "react";
import { Clock } from "lucide-react";
import type { ActionStatus } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { focusIsLost } from "@/lib/focus-handoff";
import { formatDate } from "@/lib/format";
import { useBusyMenu } from "./use-busy-menu";

export const SNOOZE_PRESET_DAYS = [7, 14, 30] as const;
export const SNOOZE_MAX_DAYS = 90;

const DAY_MS = 86_400_000;

export function snoozeUntil(days: number, now = Date.now()): string {
  const bounded = Math.min(days, SNOOZE_MAX_DAYS);
  return new Date(now + bounded * DAY_MS).toISOString();
}

function useSwapFocus(busy: boolean) {
  const from = useRef<Element | null>(null);
  useEffect(() => {
    if (!busy) from.current = null;
  }, [busy]);
  const claim = useCallback((node: HTMLButtonElement | null) => {
    if (!node || from.current === null) return;
    if (focusIsLost() || document.activeElement === from.current) {
      node.focus();
    }
  }, []);
  const arm = useCallback(() => {
    from.current = document.activeElement ?? document.body;
  }, []);
  return { arm, claim };
}

export function ActionSnoozeMenu({
  status,
  snoozedUntil,
  busy,
  onSnooze,
  onWake,
}: {
  status: ActionStatus;
  snoozedUntil: string | null;
  busy: boolean;
  onSnooze: (snoozedUntil: string) => void;
  onWake: () => void;
}) {
  const { arm, claim } = useSwapFocus(busy);
  const menu = useBusyMenu(busy);
  const swap = (update: () => void) => {
    if (busy) return;
    arm();
    update();
  };

  if (status === "SNOOZED") {
    return (
      <Button
        ref={claim}
        variant="outline"
        size="sm"
        aria-disabled={busy || undefined}
        onClick={() => swap(onWake)}
      >
        <Clock aria-hidden className="size-4" />
        {snoozedUntil ? `Wakes ${formatDate(snoozedUntil)}` : "Wake now"}
      </Button>
    );
  }

  return (
    <DropdownMenu {...menu}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={claim}
          variant="outline"
          size="sm"
          aria-disabled={busy || undefined}
          data-command="snooze"
        >
          <Clock aria-hidden className="size-4" />
          Snooze
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SNOOZE_PRESET_DAYS.map((days) => (
          <DropdownMenuItem
            key={days}
            onSelect={() => swap(() => onSnooze(snoozeUntil(days)))}
          >
            {days} days
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
