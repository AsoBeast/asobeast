"use client";

import { createContext, useContext, type RefObject } from "react";
import type { KeywordDiscoveryItem } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { siblingControl } from "@/lib/focus-handoff";
import type { DiscoveryActions } from "./use-discovery-actions";

interface RowActionsContext {
  actions: DiscoveryActions;
  handOffFocus: (
    target: HTMLElement | null | undefined,
    leaving?: HTMLElement | null,
  ) => void;
  heading: RefObject<HTMLHeadingElement | null>;
}

export const DiscoveryRowActionsContext =
  createContext<RowActionsContext | null>(null);

const TRACK_CONTROL = "[data-discovery-track]";
const DISMISS_CONTROL = "[data-discovery-dismiss]";

const holds = (ids: readonly string[] | undefined, id: string): boolean =>
  ids?.includes(id) ?? false;

export function DiscoveryRowActions({ item }: { item: KeywordDiscoveryItem }) {
  const context = useContext(DiscoveryRowActionsContext);
  if (!context) return null;
  const { actions, handOffFocus, heading } = context;
  const ids = [item.keywordId];
  const tracking =
    actions.track.isPending &&
    holds(actions.track.variables?.removes, item.keywordId);
  const dismissing =
    actions.dismiss.isPending &&
    holds(actions.dismiss.variables, item.keywordId);
  const busy = tracking || dismissing;
  const leaveFrom = (button: HTMLElement, control: string) =>
    handOffFocus(
      siblingControl(button.closest("tr"), control) ?? heading.current,
      button,
    );

  return (
    <span className="flex items-center justify-end gap-1">
      <Button
        size="sm"
        variant="outline"
        data-discovery-track
        aria-label={`Track ${item.text}`}
        aria-disabled={busy || undefined}
        aria-busy={tracking || undefined}
        onClick={(event) => {
          if (busy) return;
          leaveFrom(event.currentTarget, TRACK_CONTROL);
          actions.trackOnce({ request: { keywordIds: ids }, removes: ids });
        }}
      >
        Track
      </Button>
      <Button
        size="sm"
        variant="ghost"
        data-discovery-dismiss
        aria-label={`Dismiss ${item.text}`}
        aria-disabled={busy || undefined}
        aria-busy={dismissing || undefined}
        onClick={(event) => {
          if (busy) return;
          leaveFrom(event.currentTarget, DISMISS_CONTROL);
          actions.dismissOnce(ids);
        }}
      >
        Dismiss
      </Button>
    </span>
  );
}
