import type { LintIssue } from "@asobeast/shared";
import {
  LINT_SEVERITY_LABEL,
  LINT_SEVERITY_TONE,
} from "@/lib/metadata-display";
import { cn } from "@/lib/utils";

export function LintIssueRow({ issue }: { issue: LintIssue }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 text-dense text-muted-foreground">
      <span
        data-slot="lint-severity"
        className="inline-flex h-5 max-w-full items-center gap-1 text-label"
      >
        <span className={cn("shrink-0", LINT_SEVERITY_TONE[issue.severity])}>
          {LINT_SEVERITY_LABEL[issue.severity]}
        </span>
        <span className="truncate font-normal text-faint-foreground">
          {`· ${issue.rule}`}
        </span>
      </span>
      <span className="min-w-0 wrap-anywhere">{issue.message}</span>
    </li>
  );
}
