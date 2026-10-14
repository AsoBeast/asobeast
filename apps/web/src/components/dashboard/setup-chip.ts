import type { AppSetupSummary } from "@asobeast/shared";

export function setupChipText(
  setup: AppSetupSummary | undefined,
): string | null {
  return setup?.status === "in_progress"
    ? `Setup ${setup.done} of ${setup.total}`
    : null;
}
