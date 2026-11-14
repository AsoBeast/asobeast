"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { AuditFactorResult, Store } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { cn } from "@/lib/utils";
import {
  availabilityLabel,
  percent,
  scoreStatus,
  STATUS_LABEL,
} from "./audit-copy";
import { unlockHref } from "./audit-links";
import { FactorChecks } from "./FactorChecks";
import { TEXT_LINK } from "./layout-classes";
import { STATUS_ICON, STATUS_TONE } from "./status-icons";

export const FACTOR_COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_6.5rem_1.75rem] items-center gap-x-3 pr-2 pl-4 @lg/factors:grid-cols-[minmax(0,1fr)_6.75rem_3.25rem_8.5rem_1.75rem]";

export const FACTOR_WIDE_CELL = "hidden @lg/factors:block";

const OPEN_ROW = "bg-muted shadow-[inset_2px_0_0_var(--foreground)]";

function checksNote(factor: AuditFactorResult, totalWeight: number): string {
  const scored = factor.checks.filter((check) => check.score !== null).length;
  return [
    `Worth ${factor.weight} points of ${totalWeight}`,
    `${scored} of ${factor.checks.length} checks scored`,
    ...(factor.confidence !== undefined && factor.confidence < 1
      ? [`${percent(factor.confidence)}% measured`]
      : []),
  ].join(" · ");
}

function FactorNote({
  appId,
  factor,
  store,
}: {
  appId: string;
  factor: AuditFactorResult;
  store: Store;
}) {
  const unlock = factor.checks.find((check) => check.unlock)?.unlock ?? null;
  if (factor.availability === "awaiting-input" && unlock) {
    return (
      <Link
        href={unlockHref(appId, unlock.kind)}
        className={cn(TEXT_LINK, "text-caption")}
      >
        {unlock.label}
      </Link>
    );
  }
  const firstIssue = factor.checks.find(
    (check) => check.status === "warn" || check.status === "fail",
  );
  const note = firstIssue
    ? `${firstIssue.label}: ${firstIssue.detail}`
    : availabilityLabel(factor.availability, store);
  return note ? (
    <span className="text-caption wrap-anywhere text-muted-foreground">
      {note}
    </span>
  ) : null;
}

export function FactorRow({
  appId,
  factor,
  store,
  totalWeight,
}: {
  appId: string;
  factor: AuditFactorResult;
  store: Store;
  totalWeight: number;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const status = scoreStatus(factor.score);
  const Icon = STATUS_ICON[status];
  const waiting =
    factor.availability === "awaiting-input" &&
    factor.checks.some((check) => check.unlock);

  return (
    <article
      aria-label={factor.label}
      className="border-b border-border-subtle last:border-b-0"
    >
      <div className={cn(FACTOR_COLUMNS, "min-h-14 py-2", open && OPEN_ROW)}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-dense font-medium">{factor.label}</h3>
          <FactorNote appId={appId} factor={factor} store={store} />
        </div>
        <span
          className={cn(
            FACTOR_WIDE_CELL,
            "text-dense whitespace-nowrap",
            status === "unanswered" && "text-muted-foreground",
          )}
        >
          <span className="flex items-center gap-1.5">
            <Icon
              aria-hidden
              className={cn("size-4 shrink-0", STATUS_TONE[status])}
            />
            <span>{STATUS_LABEL[status]}</span>
          </span>
        </span>
        <span
          className={cn(
            FACTOR_WIDE_CELL,
            "numeric text-right text-dense text-muted-foreground",
          )}
        >
          {`${factor.weight} pts`}
        </span>
        <span className="grid grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-2.5">
          <Meter
            value={factor.score ?? 0}
            max={10}
            tone="health"
            className="h-1.5"
          />
          <span
            className={cn(
              "numeric text-right text-dense font-medium",
              factor.score === null && "text-muted-foreground",
            )}
          >
            {factor.score === null ? "—" : factor.score}
          </span>
        </span>
        {waiting ? (
          <span />
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`${open ? "Hide" : "Show"} checks for ${factor.label}`}
            onClick={() => setOpen(!open)}
          >
            <ChevronRight
              className={cn(
                "transition-transform duration-150 motion-reduce:transition-none",
                open && "rotate-90",
              )}
            />
          </Button>
        )}
      </div>
      {open ? (
        <div
          id={panelId}
          className={cn("flex flex-col gap-3 px-4 pt-1 pb-3", OPEN_ROW)}
        >
          <span className="text-caption text-faint-foreground">
            {checksNote(factor, totalWeight)}
          </span>
          <FactorChecks appId={appId} checks={factor.checks} />
        </div>
      ) : null}
    </article>
  );
}
