import { useId } from "react";
import Link from "next/link";
import type {
  AuditRecommendation,
  AuditRecommendations,
} from "@asobeast/shared";
import { PriorityWord } from "@/components/actions/PriorityWord";
import {
  FOOTER_LINK,
  PANEL_COUNT,
  PANEL_HEADER,
} from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { EFFORT_LABEL, fixesWorth, liftFigure, liftLabel } from "./audit-copy";
import { targetHref } from "./audit-links";
import { topFixes } from "./top-fixes";

const BAR_MAX_PERCENT = 58;
const BAR_MIN_PERCENT = 2;

const ROW =
  "relative grid min-h-9 grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-x-3 rounded-md px-2 py-2 text-dense sm:grid-cols-[4rem_minmax(0,1fr)_auto_auto]";

const ROW_LINK =
  "outline-none transition-colors duration-150 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring";

function barWidth(lift: number | undefined, largest: number): string {
  const share = largest === 0 ? 0 : (lift ?? 0) / largest;
  return `${Math.max(BAR_MIN_PERCENT, Math.round(share * BAR_MAX_PERCENT))}%`;
}

function FixRow({
  appId,
  item,
  largest,
}: {
  appId: string;
  item: AuditRecommendation;
  largest: number;
}) {
  const href = item.target ? targetHref(appId, item.target) : null;
  const cells = (
    <>
      <span
        aria-hidden
        className="absolute inset-y-1 left-[4.25rem] rounded-md bg-chart-tint sm:left-[4.75rem]"
        style={{ width: barWidth(item.lift, largest) }}
      />
      <span className="relative">
        {item.impact ? <PriorityWord priority={item.impact} /> : null}
      </span>
      <span dir="auto" className="relative font-medium wrap-anywhere">
        {item.label}
      </span>
      <span className="relative hidden pt-px text-caption whitespace-nowrap text-faint-foreground sm:inline">
        {item.effort ? EFFORT_LABEL[item.effort] : ""}
      </span>
      <span className="numeric relative font-medium whitespace-nowrap">
        <span aria-hidden>{liftFigure(item.lift)}</span>
        <span className="sr-only">{liftLabel(item.lift)}</span>
      </span>
    </>
  );

  return (
    <li>
      {href ? (
        <Link href={href} className={cn(ROW, ROW_LINK)}>
          {cells}
        </Link>
      ) : (
        <div className={ROW}>{cells}</div>
      )}
    </li>
  );
}

export function AuditTopFixes({
  appId,
  recommendations,
}: {
  appId: string;
  recommendations: AuditRecommendations;
}) {
  const headingId = useId();
  const fixes = topFixes(recommendations);
  const worth = fixesWorth(fixes);
  const largest = Math.max(0, ...fixes.map((fix) => fix.lift ?? 0));

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>Top fixes</h2>
          </CardTitle>
          {worth === null ? null : (
            <CardAction className={cn(PANEL_COUNT, "numeric")}>
              {worth}
            </CardAction>
          )}
        </CardHeader>
        {fixes.length === 0 ? (
          <CardContent>
            <EmptyState title="No change is waiting on you right now." />
          </CardContent>
        ) : (
          <>
            <CardContent className="px-2">
              <ol className="flex list-none flex-col p-0">
                {fixes.map((item) => (
                  <FixRow
                    key={`${item.factorId}-${item.checkId}`}
                    appId={appId}
                    item={item}
                    largest={largest}
                  />
                ))}
              </ol>
            </CardContent>
            <CardFooter className="justify-between">
              <span>By estimated lift</span>
              <Link href="#action-plan" className={FOOTER_LINK}>
                View the full plan
              </Link>
            </CardFooter>
          </>
        )}
      </Card>
    </section>
  );
}
