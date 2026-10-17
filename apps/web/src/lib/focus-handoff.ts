import { useCallback, useEffect, useRef, type RefCallback } from "react";

interface FocusRoot {
  activeElement: unknown;
  body: unknown;
}

export function focusIsLost(root: FocusRoot = document): boolean {
  return root.activeElement === null || root.activeElement === root.body;
}

export function survivingNeighbour<T>(
  items: readonly T[],
  removed: (item: T) => boolean,
): T | undefined {
  const first = items.findIndex(removed);
  if (first === -1) return undefined;
  return (
    items.slice(first + 1).find((item) => !removed(item)) ?? items[first - 1]
  );
}

export function useFocusAfterCommit(): (
  target: HTMLElement | null | undefined,
) => void {
  const pending = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const target = pending.current;
    pending.current = null;
    if (target?.isConnected && focusIsLost()) target.focus();
  });

  return useCallback((target) => {
    pending.current = target ?? null;
  }, []);
}

export const CLAIM_WINDOW_MS = 30_000;

interface ArmedHandoff {
  key: string;
  at: number;
  from: unknown;
}

let armed: ArmedHandoff | null = null;

export function isClaimable(
  handoff: ArmedHandoff | null,
  key: string,
  now: number,
  root: FocusRoot = document,
): boolean {
  if (handoff === null || handoff.key !== key) return false;
  if (now - handoff.at > CLAIM_WINDOW_MS) return false;
  return focusIsLost(root) || root.activeElement === handoff.from;
}

export function armFocusHandoff(key: string): void {
  armed = { key, at: Date.now(), from: document.activeElement };
}

export function useFocusClaim(key: string): RefCallback<HTMLElement> {
  return useCallback(
    (node) => {
      if (!node || !isClaimable(armed, key, Date.now())) return;
      armed = null;
      node.focus();
    },
    [key],
  );
}
