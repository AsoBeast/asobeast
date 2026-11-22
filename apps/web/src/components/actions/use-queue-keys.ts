"use client";

import { useEffect, useEffectEvent, useState } from "react";
import {
  commandApplies,
  commandFor,
  isTypingTarget,
  nextFocus,
  overlayOpen,
  type QueueCommand,
} from "./queue-keys";
import type { RowMenuFocus } from "./row-menu-request";

const QUEUE = "#queue";
const ROW = "li[id^='action-']";

const MENU_FOCUS: Partial<Record<QueueCommand["kind"], RowMenuFocus>> = {
  snooze: "first",
  dismiss: "dismiss",
};

const rowElement = (id: string) => document.getElementById(`action-${id}`);

function pressDone(id: string): void {
  [
    ...(rowElement(id)?.querySelectorAll<HTMLElement>(
      '[data-command="done"]',
    ) ?? []),
  ]
    .find((element) => element.offsetParent !== null)
    ?.click();
}

const menuAvailable = (id: string): boolean =>
  Boolean(
    rowElement(id)?.querySelector(
      '[data-command="more"]:not([aria-disabled="true"])',
    ),
  );

export function useQueueKeys({
  ids,
  onOpen,
  onSelect,
  onClear,
  onMenu,
}: {
  ids: readonly string[];
  onOpen: (id: string) => void;
  onSelect: (id: string) => void;
  onClear: () => void;
  onMenu: (id: string, focus: RowMenuFocus) => void;
}) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const run = (command: QueueCommand, id: string | null) => {
    switch (command.kind) {
      case "move": {
        const next = nextFocus(ids, id, command.delta);
        if (next) rowElement(next)?.focus();
        return;
      }
      case "search":
        document
          .querySelector<HTMLElement>('input[aria-label="Search actions"]')
          ?.focus();
        return;
      case "help":
        setHelpOpen(true);
        return;
      case "clear":
        onClear();
        return;
    }
    if (id === null) return;
    if (command.kind === "open") onOpen(id);
    if (command.kind === "select") onSelect(id);
    if (command.kind === "done") pressDone(id);
    const focus = MENU_FOCUS[command.kind];
    if (focus && menuAvailable(id)) onMenu(id, focus);
  };

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    if (
      event.defaultPrevented ||
      isTypingTarget(target) ||
      overlayOpen(document)
    ) {
      return;
    }
    const command = commandFor(event);
    if (!command) return;
    const row = target?.closest<HTMLElement>(ROW) ?? null;
    const scope = {
      inQueue: target?.closest(QUEUE) != null,
      withinRow: row !== null,
      onRow: row !== null && row === target,
    };
    if (!commandApplies(event, command, scope)) return;
    event.preventDefault();
    run(command, row ? row.id.replace(/^action-/, "") : null);
  });

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return { focusedId, setFocusedId, helpOpen, setHelpOpen };
}
