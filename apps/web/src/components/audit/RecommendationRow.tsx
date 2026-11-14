import Link from "next/link";
import type { AuditRecommendation } from "@asobeast/shared";
import { PriorityWord } from "@/components/actions/PriorityWord";
import { cn } from "@/lib/utils";
import { EFFORT_LABEL, liftLabel, TARGET_LABEL } from "./audit-copy";
import { targetHref } from "./audit-links";
import { TEXT_LINK } from "./layout-classes";

export const PLAN_COLUMNS =
  "grid grid-cols-[3.5rem_minmax(0,1fr)_auto] gap-x-3 px-4 @3xl/plan:grid-cols-[4rem_minmax(0,1fr)_6rem_15rem_7rem]";

const WIDE_ROW = "@3xl/plan:row-start-1";

export function RecommendationRow({
  appId,
  item,
}: {
  appId: string;
  item: AuditRecommendation;
}) {
  const href = item.target ? targetHref(appId, item.target) : null;
  const where = item.target ? TARGET_LABEL[item.target] : null;

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
          {item.label}
        </h4>
        <p className="text-caption wrap-anywhere text-muted-foreground">
          {item.detail}
        </p>
        {item.fix ? (
          <p className="text-caption wrap-anywhere">{item.fix}</p>
        ) : null}
      </div>
      <span className="numeric col-start-3 row-start-1 text-right font-medium whitespace-nowrap @3xl/plan:col-start-5">
        {liftLabel(item.lift)}
      </span>
      {item.effort ? (
        <span
          className={cn(
            "col-start-2 text-muted-foreground @3xl/plan:col-start-3",
            WIDE_ROW,
          )}
        >
          {EFFORT_LABEL[item.effort]}
        </span>
      ) : null}
      <span
        className={cn(
          "col-span-2 col-start-2 @3xl/plan:col-span-1 @3xl/plan:col-start-4",
          WIDE_ROW,
        )}
      >
        {where === null ? null : href ? (
          <Link href={href} className={TEXT_LINK}>
            {where}
          </Link>
        ) : (
          <span className="text-muted-foreground">{where}</span>
        )}
      </span>
    </li>
  );
}
