import type { LintIssue } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import {
  LINT_SEVERITY_LABEL,
  LINT_SEVERITY_VARIANT,
} from "@/lib/metadata-display";

export function LintIssueRow({ issue }: { issue: LintIssue }) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body text-muted-foreground">
      <Badge
        variant={LINT_SEVERITY_VARIANT[issue.severity]}
        className="h-auto min-h-5 max-w-full py-px whitespace-normal"
      >
        {LINT_SEVERITY_LABEL[issue.severity]} · {issue.rule}
      </Badge>
      <span className="min-w-0 wrap-anywhere">{issue.message}</span>
    </li>
  );
}
