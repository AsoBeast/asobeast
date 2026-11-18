import { pluralize } from "@/lib/format";

export const NOTHING_TICKED: ReadonlySet<string> = new Set();

export function trackSelectedLabel(count: number): string {
  return count === 0 ? "Track selected" : `Track ${count} selected`;
}

export function trackingSelectedMessage(count: number): string {
  return `Tracking ${pluralize(count, "keyword")}. Positions arrive within minutes.`;
}

export function withTick(
  ticked: ReadonlySet<string>,
  text: string,
  on: boolean,
): ReadonlySet<string> {
  const next = new Set(ticked);
  if (on) next.add(text);
  else next.delete(text);
  return next;
}
