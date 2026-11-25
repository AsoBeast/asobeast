"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { ListingDraftField } from "@/lib/listing-draft";

let revealed: ListingDraftField | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function announce(field: ListingDraftField | null): void {
  revealed = field;
  for (const listener of listeners) listener();
}

export const revealDraftField = (field: ListingDraftField): void =>
  announce(field);

export function useDraftFieldReveal(field: ListingDraftField): boolean {
  const requested = useSyncExternalStore(
    subscribe,
    () => revealed === field,
    () => false,
  );
  useEffect(() => {
    if (requested) announce(null);
  }, [requested]);
  return requested;
}
