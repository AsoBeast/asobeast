import {
  useCallback,
  useEffect,
  useRef,
  type RefCallback,
  type RefObject,
} from "react";

interface FocusRoot {
  activeElement: unknown;
  body: unknown;
}

export function focusIsLost(root: FocusRoot = document): boolean {
  return root.activeElement === null || root.activeElement === root.body;
}

interface Container {
  contains(node: unknown): boolean;
}

const isContainer = (value: unknown): value is Container =>
  typeof (value as Partial<Container> | null)?.contains === "function";

export function focusCanMoveTo(
  target: unknown,
  root: FocusRoot = document,
): boolean {
  const active = root.activeElement;
  return (
    focusIsLost(root) ||
    (active !== target && isContainer(active) && active.contains(target))
  );
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

export function siblingControl(
  row: Element | null,
  control: string,
): HTMLElement | null {
  const rows = row?.parentElement ? [...row.parentElement.children] : [];
  const next = survivingNeighbour(rows, (each) => each === row);
  return next?.querySelector<HTMLElement>(control) ?? null;
}

export function useCloseFocusHandoff(): {
  handOff: (target: HTMLElement | null) => void;
  onCloseAutoFocus: (event: Event) => void;
} {
  const target = useRef<HTMLElement | null>(null);
  const handOff = useCallback((next: HTMLElement | null) => {
    target.current = next;
  }, []);
  const onCloseAutoFocus = useCallback((event: Event) => {
    const next = target.current;
    target.current = null;
    if (!next?.isConnected) return;
    event.preventDefault();
    next.focus();
  }, []);
  return { handOff, onCloseAutoFocus };
}

export function useFocusAfterCommit(): (
  target: HTMLElement | null | undefined,
) => void {
  const pending = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const target = pending.current;
    pending.current = null;
    if (target?.isConnected && focusCanMoveTo(target)) target.focus();
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

const FOCUSABLE = "a[href], button:not(:disabled)";

export function useFocusGroupClaim(
  key: string,
  controlPresent: boolean,
): RefObject<HTMLDivElement | null> {
  const group = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (controlPresent) return;
    const target = group.current?.querySelector<HTMLElement>(FOCUSABLE);
    if (!target || !isClaimable(armed, key, Date.now())) return;
    armed = null;
    target.focus();
  }, [key, controlPresent]);

  return group;
}
