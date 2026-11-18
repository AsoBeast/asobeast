import {
  useCallback,
  useEffect,
  useLayoutEffect,
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

const CARD = '[data-slot="card"]';
const CARD_HEADER_ACTION = '[data-slot="card-header"] button';

export function cardAction(element: Element | null): HTMLElement | null {
  return (
    element?.closest(CARD)?.querySelector<HTMLElement>(CARD_HEADER_ACTION) ??
    null
  );
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

export const returnFocusTo =
  (target: RefObject<HTMLElement | null> | undefined) =>
  (event: Event): void => {
    const element = target?.current;
    if (!element?.isConnected) return;
    event.preventDefault();
    element.focus();
  };

const isConnected = (node: unknown): boolean =>
  typeof node === "object" &&
  node !== null &&
  "isConnected" in node &&
  node.isConnected === true;

export type PendingFocusStep = "wait" | "focus" | "drop";

export function pendingFocusStep(
  target: unknown,
  leaving: unknown,
  root: FocusRoot = document,
): PendingFocusStep {
  if (!isConnected(target)) return "drop";
  if (focusIsLost(root)) return "focus";
  if (isConnected(leaving)) {
    return root.activeElement === leaving ? "wait" : "drop";
  }
  return focusCanMoveTo(target, root) ? "focus" : "drop";
}

interface PendingFocus {
  target: HTMLElement;
  leaving: HTMLElement | null;
}

export function useFocusAfterCommit(): (
  target: HTMLElement | null | undefined,
  leaving?: HTMLElement | null,
) => void {
  const pending = useRef<PendingFocus | null>(null);

  useEffect(() => {
    const handoff = pending.current;
    if (handoff === null) return;
    const step = pendingFocusStep(handoff.target, handoff.leaving);
    if (step === "wait") return;
    pending.current = null;
    if (step === "focus") handoff.target.focus();
  });

  return useCallback((target, leaving = null) => {
    pending.current = target ? { target, leaving } : null;
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

export function renewHandoff(
  handoff: ArmedHandoff | null,
  key: string,
  now: number,
): ArmedHandoff | null {
  if (handoff === null || handoff.key !== key) return handoff;
  return { ...handoff, at: now };
}

export function renewFocusHandoff(key: string): void {
  armed = renewHandoff(armed, key, Date.now());
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

const OUT_OF_REACH = '[aria-hidden="true"], [inert]';

const tabbable = (...kinds: string[]) =>
  kinds.map((kind) => `${kind}:not([tabindex="-1"])`).join(", ");

const FOCUSABLE = tabbable("a[href]", "button:not(:disabled)");

const RECOVERY_CANDIDATES = tabbable(
  "a[href]",
  "button:not(:disabled)",
  'input:not(:disabled):not([type="hidden"])',
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[tabindex]",
);

const TAB_LIST = '[role="tablist"]';
const SELECTED_TAB = '[role="tab"][aria-selected="true"]';

const withinReach = (element: Element): boolean =>
  element.closest(OUT_OF_REACH) === null;

const focusTargets = (control: HTMLElement): HTMLElement[] => {
  if (!control.matches(TAB_LIST)) return [control];
  const selected = control.querySelector<HTMLElement>(SELECTED_TAB);
  if (!selected) return [control];
  return withinReach(selected) ? [selected] : [];
};

const reachableIn = (group: Element, selector: string): HTMLElement[] =>
  [...group.querySelectorAll<HTMLElement>(selector)].filter(withinReach);

export const firstFocusable = (group: Element | null): HTMLElement | null =>
  (group && reachableIn(group, FOCUSABLE)[0]) ?? null;

export function useFocusGroupClaim(
  key: string,
  controlPresent: boolean,
): RefObject<HTMLDivElement | null> {
  const group = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (controlPresent) return;
    const target = firstFocusable(group.current);
    if (!target || !isClaimable(armed, key, Date.now())) return;
    armed = null;
    target.focus();
  }, [key, controlPresent]);

  return group;
}

const RETRY_CONTAINER = `${CARD}, [role="dialog"], section`;

export function recoveryCandidates(container: Element | null): HTMLElement[] {
  if (!container?.isConnected) return [];
  const controls = reachableIn(container, RECOVERY_CANDIDATES).flatMap(
    focusTargets,
  );
  return container instanceof HTMLElement &&
    container.hasAttribute("tabindex") &&
    withinReach(container)
    ? [...controls, container]
    : controls;
}

const holdsFocus = (candidate: HTMLElement, root: FocusRoot): boolean => {
  const active = root.activeElement;
  return (
    active === candidate ||
    (active instanceof Node && candidate.contains(active))
  );
};

export function focusFirstAvailable(
  candidates: readonly HTMLElement[],
  root: FocusRoot = document,
): HTMLElement | undefined {
  return candidates.find((candidate) => {
    candidate.focus({ preventScroll: true });
    return holdsFocus(candidate, root);
  });
}

export function recoverFocusIn(
  container: Element | null,
  root: FocusRoot = document,
): HTMLElement | undefined {
  if (!focusIsLost(root)) return undefined;
  return focusFirstAvailable(recoveryCandidates(container), root);
}

export function useRetryRecoveryFocus(): RefObject<HTMLButtonElement | null> {
  const retry = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const button = retry.current;
    const container = button?.closest(RETRY_CONTAINER) ?? null;
    return () => {
      if (!button || document.activeElement !== button) return;
      queueMicrotask(() => recoverFocusIn(container));
    };
  }, []);

  return retry;
}
