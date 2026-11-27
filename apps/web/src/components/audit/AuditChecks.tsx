"use client";

import type { AuditCheckStatus, AuditFactorResult } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { PANEL_COUNT, PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MessageTranslator } from "@/i18n/translator";
import { CHECK_STATUSES, checkSummary, type CheckCounts } from "./check-counts";
import { STATUS_ICON, STATUS_TONE } from "./status-icons";

const SEGMENT: Record<AuditCheckStatus, string> = {
  pass: "bg-success",
  warn: "bg-warning",
  fail: "bg-destructive",
  unanswered: "bg-border",
};

const countsText = (counts: CheckCounts, t: MessageTranslator): string =>
  CHECK_STATUSES.map(
    (status) => `${counts[status]} ${t(`checkCountWord.${status}`)}`,
  ).join(", ");

export function AuditChecks({ factors }: { factors: AuditFactorResult[] }) {
  const t = useTranslations("audit");
  const { counts, total, factors: factorCount } = checkSummary(factors);
  if (total === 0) return null;

  return (
    <Card>
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>{t("checks")}</h2>
        </CardTitle>
        <CardAction className={cn(PANEL_COUNT, "numeric")}>
          {t("passCount", { pass: counts.pass, total })}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div
          role="img"
          aria-label={t("checksByResult", { counts: countsText(counts, t) })}
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
                <span>{t(`statuses.${status}`)}</span>
                <span className="numeric ml-auto font-medium">
                  {counts[status]}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
      <CardFooter>
        <span>
          {t("checksAcross", { checks: total, factors: factorCount })}
        </span>
      </CardFooter>
    </Card>
  );
}
