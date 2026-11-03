"use client";

import { useSyncExternalStore } from "react";
import { hasUnseenRelease } from "./release-notes";

export const SEEN_RELEASE_KEY = "asobeast.whatsNew.seen";

export function readSeenRelease(storage: () => Storage): string | null {
  try {
    return storage().getItem(SEEN_RELEASE_KEY) || null;
  } catch {
    return null;
  }
}

export function writeSeenRelease(
  storage: () => Storage,
  version: string,
): boolean {
  try {
    storage().setItem(SEEN_RELEASE_KEY, version);
    return true;
  } catch {
    return false;
  }
}

const listeners = new Set<() => void>();
let unsaved: string | null = null;
const browserStorage = () => window.localStorage;

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const snapshot = () => unsaved ?? readSeenRelease(browserStorage);
const serverSnapshot = () => undefined;

function markSeen(version: string) {
  if (!hasUnseenRelease(version, snapshot())) return;
  unsaved = writeSeenRelease(browserStorage, version) ? null : version;
  listeners.forEach((listener) => listener());
}

export function useSeenRelease() {
  const seen = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return [seen, markSeen] as const;
}
