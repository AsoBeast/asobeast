import { DELETION_REASONS, type DeletionReason } from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";
import enWorkspace from "../../messages/en/workspace.json";

const REASON_KEYS: Record<DeletionReason, keyof typeof enWorkspace.reasons> = {
  "too-expensive": "tooExpensive",
  "missing-feature": "missingFeature",
  "not-using": "notUsing",
  "switched-tool": "switchedTool",
  other: "other",
};

export const DELETION_REASON_LABELS: Record<DeletionReason, string> =
  Object.fromEntries(
    DELETION_REASONS.map((reason) => [
      reason,
      enWorkspace.reasons[REASON_KEYS[reason]],
    ]),
  ) as Record<DeletionReason, string>;

export const UNANSWERED_REASON = "unanswered";

export type DeletionReasonChoice = DeletionReason | typeof UNANSWERED_REASON;

export const DELETION_REASON_CHOICES: readonly {
  value: DeletionReasonChoice;
  labelKey: string;
}[] = [
  { value: UNANSWERED_REASON, labelKey: "reasons.preferNotToSay" },
  ...DELETION_REASONS.map((reason) => ({
    value: reason,
    labelKey: `reasons.${REASON_KEYS[reason]}`,
  })),
];

export function deletionReasonChoices(
  translator: MessageTranslator,
): { value: DeletionReasonChoice; label: string }[] {
  return DELETION_REASON_CHOICES.map((choice) => ({
    ...choice,
    label: translator(choice.labelKey),
  }));
}

export function deletionReasonLabel(
  reason: DeletionReasonChoice,
  translator: MessageTranslator,
): string {
  return translator(
    reason === UNANSWERED_REASON
      ? "reasons.preferNotToSay"
      : `reasons.${REASON_KEYS[reason]}`,
  );
}

export function deletionReasonOf(choice: string): DeletionReason | undefined {
  return DELETION_REASONS.find((reason) => reason === choice);
}
