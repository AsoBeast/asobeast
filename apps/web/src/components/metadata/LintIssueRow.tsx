import type { LintIssue } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { lintSeverityLabel, LINT_SEVERITY_TONE } from "@/lib/metadata-display";
import { cn } from "@/lib/utils";

export function LintIssueRow({ issue }: { issue: LintIssue }) {
  const t = useTranslations("metadata");
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 text-dense text-muted-foreground">
      <span
        data-slot="lint-severity"
        className="inline-flex h-5 max-w-full items-center gap-1 text-label"
      >
        <span className={cn("shrink-0", LINT_SEVERITY_TONE[issue.severity])}>
          {lintSeverityLabel(issue.severity, t)}
        </span>
        <span className="truncate font-normal text-faint-foreground">
          {`· ${issue.rule}`}
        </span>
      </span>
      <span className="min-w-0 wrap-anywhere">{issue.message}</span>
    </li>
  );
}
