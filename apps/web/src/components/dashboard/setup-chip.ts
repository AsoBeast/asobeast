import type { AppSetupSummary } from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";

export function setupChipText(
  setup: AppSetupSummary | undefined,
  t: MessageTranslator,
): string | null {
  return setup?.status === "in_progress"
    ? t("table.setupChip", { done: setup.done, total: setup.total })
    : null;
}
