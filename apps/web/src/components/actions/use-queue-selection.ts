"use client";

import { useState } from "react";
import type { ActionItem } from "@asobeast/shared";

export interface QueueSelection {
  enabled: boolean;
  selected: string[];
  selectable: string[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  setMany: (ids: readonly string[], selected: boolean) => void;
  clear: () => void;
}

export function useQueueSelection(
  visible: readonly ActionItem[],
  enabled: boolean,
): QueueSelection {
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const selectable = enabled
    ? visible.filter((item) => item.status === "OPEN").map((item) => item.id)
    : [];
  const selected = selectable.filter((id) => chosen.has(id));

  const setMany = (ids: readonly string[], value: boolean) =>
    setChosen((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (value) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  return {
    enabled,
    selected,
    selectable,
    isSelected: (id) => selected.includes(id),
    toggle: (id) => setMany([id], !chosen.has(id)),
    setMany,
    clear: () => setChosen(new Set()),
  };
}
