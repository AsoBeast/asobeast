import { useCallback, useEffect, useRef } from "react";

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
