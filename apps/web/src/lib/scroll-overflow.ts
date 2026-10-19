import { useEffect, useState } from "react";

export const OVERFLOW_TOLERANCE_PX = 1;

interface ScrollBox {
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
}

export function overflows(box: ScrollBox): boolean {
  return (
    box.scrollWidth > box.clientWidth + OVERFLOW_TOLERANCE_PX ||
    box.scrollHeight > box.clientHeight + OVERFLOW_TOLERANCE_PX
  );
}

export function useOverflowing(node: HTMLElement | null): boolean {
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    if (!node) return;
    const measure = () => setOverflowing(overflows(node));
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => observer.disconnect();
  }, [node]);

  return overflowing;
}
