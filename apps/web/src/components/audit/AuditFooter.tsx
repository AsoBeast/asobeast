import { ChevronRight } from "lucide-react";
import type { AppAuditResult } from "@asobeast/shared";
import { formatDate } from "@/lib/format";
import { percent } from "./audit-copy";

function computedLine(audit: AppAuditResult): string {
  return [
    `Computed ${formatDate(audit.generatedAt)}`,
    ...(audit.rubricVersion ? [`Rubric ${audit.rubricVersion}`] : []),
    ...(audit.confidence === undefined
      ? []
      : [`${percent(audit.confidence)}% measured`]),
  ].join(" · ");
}

export function AuditFooter({ audit }: { audit: AppAuditResult }) {
  const limitations = audit.limitations ?? [];

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-caption text-faint-foreground">
        {computedLine(audit)}
      </p>
      {limitations.length === 0 ? null : (
        <details className="group">
          <summary className="inline-flex list-none items-center gap-1.5 rounded-sm text-dense font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden
              className="size-4 text-muted-foreground transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none"
            />
            <span>What this audit cannot see</span>
          </summary>
          <ul className="mt-2.5 flex max-w-[70ch] list-none flex-col gap-2 p-0 text-dense text-muted-foreground">
            {limitations.map((limitation) => (
              <li key={limitation.id}>
                <span className="font-medium text-foreground">
                  {`${limitation.label}. `}
                </span>
                <span>{limitation.detail}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
