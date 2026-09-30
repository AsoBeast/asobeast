"use client";

import { useEffect, useEffectEvent, useState } from "react";
import {
  commandApplies,
  commandFor,
  isTypingTarget,
  nextFocus,
  type QueueCommand,
} from "./queue-keys";

const OVERLAY = '[role="menu"],[role="dialog"],[role="listbox"]';
const QUEUE = "#queue";
const ROW = "li[id^='action-']";

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

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    if (
      event.defaultPrevented ||
      isTypingTarget(target) ||
      document.querySelector(OVERLAY)
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
