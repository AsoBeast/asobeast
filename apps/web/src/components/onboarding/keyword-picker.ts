import type { KeywordSuggestionStrategy } from "@asobeast/shared";

export const PICKER_STRATEGIES = [
  "metadata",
  "search",
] as const satisfies readonly KeywordSuggestionStrategy[];

export type PickerStrategy = (typeof PICKER_STRATEGIES)[number];

export const PICKER_LABELS: Record<PickerStrategy, string> = {
  metadata: "From your listing",
  search: "Store autocomplete",
};

export const isPickerStrategy = (value: string): value is PickerStrategy =>
  (PICKER_STRATEGIES as readonly string[]).includes(value);

export function pickerButtonLabel(count: number): string {
  return count === 0 ? "Track selected" : `Track ${count} selected`;
}

export function remainingToTarget(
  active: number | null,
  target: number,
): number {
  return Math.max(0, target - (active ?? 0));
}
