import type { AppStoreLocalization } from "@asobeast/shared";

export interface HandoffGenerations {
  target: AppStoreLocalization | null;
  generations: Partial<Record<AppStoreLocalization, number>>;
}

export const handoffGenerationsOf = (
  target: AppStoreLocalization | null,
): HandoffGenerations => ({
  target,
  generations: target === null ? {} : { [target]: 1 },
});

export const nextHandoffGenerations = (
  { generations }: HandoffGenerations,
  target: AppStoreLocalization | null,
): HandoffGenerations => ({
  target,
  generations:
    target === null
      ? generations
      : { ...generations, [target]: (generations[target] ?? 0) + 1 },
});

export function editorKeyOf(
  { generations }: HandoffGenerations,
  item: AppStoreLocalization,
): string {
  const generation = generations[item];
  return generation === undefined ? "stored" : `handoff-${generation}`;
}
