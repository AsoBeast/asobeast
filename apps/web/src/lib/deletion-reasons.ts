import { DELETION_REASONS, type DeletionReason } from "@asobeast/shared";

export const DELETION_REASON_LABELS: Record<DeletionReason, string> = {
  "too-expensive": "Too expensive",
  "missing-feature": "Missing a feature",
  "not-using": "Not using it",
  "switched-tool": "Switched to another tool",
  other: "Other",
};

export const UNANSWERED_REASON = "unanswered";

export type DeletionReasonChoice = DeletionReason | typeof UNANSWERED_REASON;

export const DELETION_REASON_CHOICES: readonly {
  value: DeletionReasonChoice;
  label: string;
}[] = [
  { value: UNANSWERED_REASON, label: "Prefer not to say" },
  ...DELETION_REASONS.map((reason) => ({
    value: reason,
    label: DELETION_REASON_LABELS[reason],
  })),
];

export function deletionReasonOf(choice: string): DeletionReason | undefined {
  return DELETION_REASONS.find((reason) => reason === choice);
}
