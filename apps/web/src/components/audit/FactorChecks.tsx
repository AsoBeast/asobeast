import Link from "next/link";
import type { AuditCheckResult } from "@asobeast/shared";
import { SOURCE_LABEL, STATUS_LABEL } from "./audit-copy";
import { unlockHref } from "./audit-links";
import { TEXT_LINK } from "./layout-classes";
import { STATUS_ICON, STATUS_TONE } from "./status-icons";

export function FactorChecks({
  appId,
  checks,
}: {
  appId: string;
  checks: AuditCheckResult[];
}) {
  return (
    <ul className="flex list-none flex-col gap-2.5 p-0">
      {checks.map((check) => {
        const Icon = STATUS_ICON[check.status];
        return (
          <li
            key={check.id}
            className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-dense"
          >
            <Icon
              aria-hidden
              className={`mt-0.5 size-4 ${STATUS_TONE[check.status]}`}
            />
            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-medium">{check.label}</span>
              <span className="text-caption text-faint-foreground">
                {check.source
                  ? `${STATUS_LABEL[check.status]} · ${SOURCE_LABEL[check.source]}`
                  : STATUS_LABEL[check.status]}
              </span>
            </span>
            <span className="col-start-2 text-caption wrap-anywhere text-muted-foreground">
              {check.detail}
            </span>
            {check.unlock ? (
              <Link
                href={unlockHref(appId, check.unlock.kind)}
                className={`col-start-2 text-caption ${TEXT_LINK}`}
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
