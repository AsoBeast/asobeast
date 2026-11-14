import type { AuditCheckStatus, AuditFactorResult } from "@asobeast/shared";
import { PANEL_COUNT, PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "./audit-copy";
import { CHECK_STATUSES, checkSummary, type CheckCounts } from "./check-counts";
import { STATUS_ICON, STATUS_TONE } from "./status-icons";

const SEGMENT: Record<AuditCheckStatus, string> = {
  pass: "bg-success",
  warn: "bg-warning",
  fail: "bg-destructive",
  unanswered: "bg-border",
};

const COUNT_WORD: Record<AuditCheckStatus, string> = {
  pass: "pass",
  warn: "need work",
  fail: "fail",
  unanswered: "not scored",
};

const countsText = (counts: CheckCounts): string =>
  CHECK_STATUSES.map(
    (status) => `${counts[status]} ${COUNT_WORD[status]}`,
  ).join(", ");

export function AuditChecks({ factors }: { factors: AuditFactorResult[] }) {
  const { counts, total, factors: factorCount } = checkSummary(factors);
  if (total === 0) return null;

  return (
    <Card>
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>Checks</h2>
        </CardTitle>
        <CardAction className={cn(PANEL_COUNT, "numeric")}>
          {`${counts.pass} of ${total} pass`}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div
          role="img"
          aria-label={`Checks by result: ${countsText(counts)}`}
          className="flex h-1.5 gap-0.5"
        >
          {CHECK_STATUSES.filter((status) => counts[status] > 0).map(
            (status) => (
              <span
                key={status}
                className={cn("min-w-1 rounded-xs", SEGMENT[status])}
                style={{ flexGrow: counts[status] }}
              />
            ),
          )}
        </div>
        <ul className="flex list-none flex-col p-0">
          {CHECK_STATUSES.map((status) => {
            const Icon = STATUS_ICON[status];
            return (
              <li
                key={status}
                className="flex h-9 items-center gap-2 text-dense"
              >
                <Icon
                  aria-hidden
                  className={cn("size-4", STATUS_TONE[status])}
                />
                <span>{STATUS_LABEL[status]}</span>
                <span className="numeric ml-auto font-medium">
                  {counts[status]}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
      <CardFooter>
        <span>{`${pluralize(total, "check")} across ${pluralize(factorCount, "factor")}`}</span>
      </CardFooter>
    </Card>
  );
}
