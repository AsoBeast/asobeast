"use client";

import { useState, type KeyboardEvent } from "react";
import {
  commandFor,
  isTypingTarget,
  nextFocus,
  ROW_COMMANDS,
  type QueueCommand,
} from "./queue-keys";

const OVERLAY = '[role="menu"],[role="dialog"]';

const rowElement = (id: string) => document.getElementById(`action-${id}`);

function press(id: string, command: string): void {
  const row = rowElement(id);
  const visible = [
    ...(row?.querySelectorAll<HTMLElement>(`[data-command="${command}"]`) ??
      []),
  ].find((element) => element.offsetParent !== null);
  const fallback = row?.querySelector<HTMLElement>('[data-command="more"]');
  (visible ?? fallback)?.click();
}

export function useQueueKeys({
  ids,
  onOpen,
  onSelect,
  onClear,
}: {
  ids: readonly string[];
  onOpen: (id: string) => void;
  onSelect: (id: string) => void;
  onClear: () => void;
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
    if (command.kind === "done") press(id, "done");
    if (command.kind === "snooze") press(id, "snooze");
    if (command.kind === "dismiss") press(id, "dismiss");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (isTypingTarget(event.target) || document.querySelector(OVERLAY)) return;
    const command = commandFor(event);
    if (!command) return;
    const row = (event.target as HTMLElement).closest<HTMLElement>(
      "li[id^='action-']",
    );
    const needsRow = ROW_COMMANDS.includes(command.kind);
    if (command.kind === "move" ? !row : needsRow && row !== event.target) {
      return;
    }
    event.preventDefault();
    run(command, row ? row.id.replace(/^action-/, "") : null);
  };

  return {
    focusedId,
    setFocusedId,
    helpOpen,
    setHelpOpen,
    onKeyDown,
  };
}
