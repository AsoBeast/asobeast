import { useCallback, useSyncExternalStore, type RefObject } from "react";

export type ScrollEdges = "none" | "start" | "end" | "both";

const EDGE_TOLERANCE_PX = 1;

export function scrollEdgesOf(box: {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}): ScrollEdges {
  const before = box.scrollLeft > EDGE_TOLERANCE_PX;
  const after =
    box.scrollLeft + box.clientWidth < box.scrollWidth - EDGE_TOLERANCE_PX;
  if (before && after) return "both";
  if (before) return "start";
  return after ? "end" : "none";
}

export function useScrollEdges(
  ref: RefObject<HTMLElement | null>,
): ScrollEdges {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const box = ref.current;
      if (!box) return () => undefined;
      const resize = new ResizeObserver(onChange);
      resize.observe(box);
      box.addEventListener("scroll", onChange, { passive: true });
      return () => {
        resize.disconnect();
        box.removeEventListener("scroll", onChange);
      };
    },
    [ref],
  );
  return useSyncExternalStore(
    subscribe,
    () => (ref.current ? scrollEdgesOf(ref.current) : "none"),
    () => "none",
  );
}
