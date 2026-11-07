"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { survivingNeighbour, useFocusAfterCommit } from "@/lib/focus-handoff";
import { lastControlBefore } from "./chip-focus";

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

const REMOVE_BUTTON = "[data-chip-remove]";
const CONTROLS = "a[href], button:not(:disabled)";

const isShown = (element: HTMLElement): boolean =>
  element.getClientRects().length > 0;

export function FilterChips({
  chips,
  onClearAll,
}: {
  chips: readonly FilterChip[];
  onClearAll: () => void;
}) {
  const list = useRef<HTMLUListElement>(null);
  const focusAfterCommit = useFocusAfterCommit();

  const fallback = (): HTMLElement | null => {
    const element = list.current;
    if (!element?.parentElement) return null;
    return lastControlBefore(
      [...element.parentElement.querySelectorAll<HTMLElement>(CONTROLS)],
      element,
      isShown,
    );
  };

  const remove = (chip: FilterChip, button: HTMLElement) => {
    const buttons = [
      ...(list.current?.querySelectorAll<HTMLElement>(REMOVE_BUTTON) ?? []),
    ];
    const leaving = (each: HTMLElement) => each.dataset.chipKey === chip.key;
    focusAfterCommit(
      survivingNeighbour(buttons, leaving) ?? fallback(),
      button,
    );
    chip.onRemove();
  };

  const clearAll = (button: HTMLElement) => {
    focusAfterCommit(fallback(), button);
    onClearAll();
  };

  if (chips.length === 0) return null;

  return (
    <ul
      ref={list}
      aria-label="Active filters"
      className="flex flex-wrap items-center gap-2"
    >
      {chips.map((chip) => (
        <li key={chip.key} className="max-w-full min-w-0">
          <Badge
            variant="secondary"
            className="h-auto min-h-6 max-w-full gap-1 py-px pr-0.5 text-left whitespace-normal wrap-anywhere"
          >
            {chip.label}
            <button
              type="button"
              data-chip-remove
              data-chip-key={chip.key}
              aria-label={`Remove ${chip.label}`}
              onClick={(event) => remove(chip, event.currentTarget)}
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-full opacity-70 outline-none hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3" aria-hidden />
            </button>
          </Badge>
        </li>
      ))}
      {chips.length > 1 ? (
        <li>
          <Button
            variant="ghost"
            size="xs"
            onClick={(event) => clearAll(event.currentTarget)}
          >
            Clear all
          </Button>
        </li>
      ) : null}
    </ul>
  );
}
