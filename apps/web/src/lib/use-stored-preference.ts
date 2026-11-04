"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const unsaved = new Map<string, string>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, raw: string): boolean {
  try {
    window.localStorage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}

export function useStoredPreference(key: string) {
  const raw = useSyncExternalStore(
    subscribe,
    () => unsaved.get(key) ?? read(key),
    () => null,
  );
  const save = useCallback(
    (next: string) => {
      if (write(key, next)) unsaved.delete(key);
      else unsaved.set(key, next);
      listeners.forEach((listener) => listener());
    },
    [key],
  );
  return [raw, save] as const;
}
