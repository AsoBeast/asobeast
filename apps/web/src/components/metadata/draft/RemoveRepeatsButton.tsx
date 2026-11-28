"use client";

import type { LintIssue } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { draftFieldSelector } from "./DraftFieldInput";
import { removeRepeats, repeatedWords } from "./repeated-words";
import { undoToast } from "./undo-toast";

const counted = (count: number, one: string, many: string) =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

export function RemoveRepeatsButton({
  value,
  issues,
  onChange,
}: {
  value: string;
  issues: readonly LintIssue[];
  onChange: (value: string) => void;
}) {
  const repeated = repeatedWords(issues);
  if (repeated.size === 0) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      className="w-fit"
      onClick={() => {
        const removal = removeRepeats(value, repeated);
        if (removal.words === 0) return;
        onChange(removal.value);
        document
          .querySelector<HTMLElement>(draftFieldSelector("keywordField"))
          ?.focus();
        undoToast(
          `Removed ${counted(removal.words, "repeated word", "repeated words")}`,
          () => onChange(value),
          `${counted(removal.chars, "character", "characters")} freed`,
        );
      }}
    >
      <span>Remove repeats</span>
    </Button>
  );
}
