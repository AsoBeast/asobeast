import Link from "next/link";
import type { AuditCheckResult } from "@asobeast/shared";
import { SOURCE_LABEL, STATUS_LABEL } from "./audit-copy";
import { unlockHref } from "./audit-links";
import { STATUS_ICON, STATUS_TONE } from "./status-icons";

export function FactorChecks({
  appId,
  checks,
}: {
  appId: string;
  checks: AuditCheckResult[];
}) {
  return (
    <ul className="flex flex-col gap-3">
      {checks.map((check) => {
        const Icon = STATUS_ICON[check.status];
        return (
          <li key={check.id} className="flex flex-col gap-1 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <Icon
                aria-hidden
                className={`size-4 ${STATUS_TONE[check.status]}`}
              />
              {check.label}
              <span className="text-caption text-muted-foreground">
                {STATUS_LABEL[check.status]}
              </span>
            </span>
            <span className="text-muted-foreground">{check.detail}</span>
            <span className="text-caption text-muted-foreground">
              {check.source ? SOURCE_LABEL[check.source] : null}
            </span>
            {check.unlock ? (
              <Link
                href={unlockHref(appId, check.unlock.kind)}
                className="w-fit text-sm font-medium underline-offset-4 hover:underline"
              >
                {check.unlock.label}
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
