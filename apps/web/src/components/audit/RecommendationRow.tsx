"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { AuditRecommendation, AuditTarget } from "@asobeast/shared";
import { PriorityWord } from "@/components/actions/PriorityWord";
import { cn } from "@/lib/utils";
import { useAppLocale } from "@/lib/use-app-locale";
import { auditLabel, auditText } from "./audit-content-zh";
import { liftLabel } from "./audit-copy";
import { targetHref } from "./audit-links";
import { TEXT_LINK } from "./layout-classes";

export const PLAN_COLUMNS =
  "grid grid-cols-[3.5rem_minmax(0,1fr)_auto] gap-x-3 px-4 @3xl/plan:grid-cols-[4rem_minmax(0,1fr)_6rem_15rem_7rem]";

const WIDE_ROW = "@3xl/plan:row-start-1";

function Where({
  appId,
  target,
}: {
  appId: string;
  target: AuditTarget | undefined;
}) {
  const t = useTranslations("audit");
  if (!target) return null;
  const href = targetHref(appId, target);
  if (href === null) {
    return (
      <span className="text-muted-foreground">{t(`targets.${target}`)}</span>
    );
  }
  return (
    <Link href={href} className={TEXT_LINK}>
      {t(`targets.${target}`)}
    </Link>
  );
}

export function RecommendationRow({
  appId,
  item,
}: {
  appId: string;
  item: AuditRecommendation;
}) {
  const t = useTranslations("audit");
  const locale = useAppLocale();
  return (
    <li
      className={cn(
        PLAN_COLUMNS,
        "items-start gap-y-1 border-b border-border-subtle py-3 text-dense last:border-b-0",
      )}
    >
      <span>
        {item.impact ? <PriorityWord priority={item.impact} /> : null}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h4 dir="auto" className="text-body font-medium wrap-anywhere">
          {auditLabel(item.label, locale)}
        </h4>
        <p className="text-caption wrap-anywhere text-muted-foreground">
          {auditText(item.detail, locale)}
        </p>
        {item.fix ? (
          <p className="text-caption wrap-anywhere">
            {auditText(item.fix, locale)}
          </p>
        ) : null}
      </div>
      <span className="numeric col-start-3 row-start-1 text-right font-medium whitespace-nowrap @3xl/plan:col-start-5">
        {liftLabel(item.lift, t)}
      </span>
      {item.effort ? (
        <span
          className={cn(
            "col-start-2 text-muted-foreground @3xl/plan:col-start-3",
            WIDE_ROW,
          )}
        >
          {t(`efforts.${item.effort}`)}
        </span>
      ) : null}
      <span
        className={cn(
          "col-span-2 col-start-2 @3xl/plan:col-span-1 @3xl/plan:col-start-4",
          WIDE_ROW,
        )}
      >
        <Where appId={appId} target={item.target} />
      </span>
    </li>
  );
}
