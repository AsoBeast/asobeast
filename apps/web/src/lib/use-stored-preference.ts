"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const unsaved = new Map<string, string>();

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null) unsaved.clear();
    else unsaved.delete(event.key);
    listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
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

export const readStoredPreference = (key: string): string | null =>
  unsaved.get(key) ?? read(key);

export function writeStoredPreference(key: string, raw: string): void {
  if (write(key, raw)) unsaved.delete(key);
  else unsaved.set(key, raw);
  listeners.forEach((listener) => listener());
}

export function useStoredPreference(key: string) {
  const raw = useSyncExternalStore(
    subscribe,
    () => readStoredPreference(key),
    () => null,
  );
  const save = useCallback(
    (next: string) => writeStoredPreference(key, next),
    [key],
  );
  return [raw, save] as const;
}
