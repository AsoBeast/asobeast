"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  AppAuditResult,
  AuditRecommendations,
  AuditUnlockSummary,
} from "@asobeast/shared";
import { LIST_HEAD } from "@/components/layout/panel-classes";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { MessageTranslator } from "@/i18n/translator";
import { BUCKETS, emptyBucketLine, fixesWorth } from "./audit-copy";
import { PLAN_COLUMNS, RecommendationRow } from "./RecommendationRow";

export const PLAN_PAGE_SIZE = 5;

const unansweredCount = (unlocks: AuditUnlockSummary[] | undefined): number =>
  (unlocks ?? []).reduce((sum, unlock) => sum + unlock.checks, 0);

function BucketPanel({
  appId,
  bucket,
  recommendations,
  unanswered,
}: {
  appId: string;
  bucket: keyof AuditRecommendations;
  recommendations: AuditRecommendations;
  unanswered: number;
}) {
  const t = useTranslations("audit");
  const [expanded, setExpanded] = useState(false);
  const items = recommendations[bucket];
  const shown = expanded ? items : items.slice(0, PLAN_PAGE_SIZE);

  return (
    <TabsContent value={bucket} className="flex flex-col">
      <h3 className="sr-only">{t(`buckets.${bucket}`)}</h3>
      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-body text-muted-foreground">
          {emptyBucketLine(unanswered, t)}
        </p>
      ) : (
        <>
          <div
            aria-hidden
            className={cn(
              PLAN_COLUMNS,
              LIST_HEAD,
              "hidden h-9 items-center border-b border-border @3xl/plan:grid",
            )}
          >
            <span>{t("plan.impact")}</span>
            <span>{t("plan.fix")}</span>
            <span>{t("plan.effort")}</span>
            <span>{t("plan.where")}</span>
            <span className="text-right">{t("plan.lift")}</span>
          </div>
          <ul className="flex list-none flex-col p-0">
            {shown.map((item) => (
              <RecommendationRow
                key={`${item.factorId}-${item.checkId}`}
                appId={appId}
                item={item}
              />
            ))}
          </ul>
          {items.length > shown.length ? (
            <div className="border-t border-border-subtle px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpanded(true)}
              >
                {t("plan.showAll", { count: items.length })}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </TabsContent>
  );
}

function planNote(
  recommendations: AuditRecommendations,
  t: MessageTranslator,
): string {
  const all = BUCKETS.flatMap((bucket) => recommendations[bucket]);
  if (all.length === 0) {
    return t("plan.empty");
  }
  const count = t("plan.count", { count: all.length });
  const worth = fixesWorth(all, t);
  return worth === null ? count : t("plan.worth", { count, points: worth });
}

export function AuditActionPlan({
  appId,
  audit,
}: {
  appId: string;
  audit: AppAuditResult;
}) {
  const t = useTranslations("audit");
  const headingId = useId();
  const unanswered = unansweredCount(audit.unlocks);

  return (
    <section id="action-plan" aria-labelledby={headingId}>
      <Tabs defaultValue="quickWins" className="gap-0">
        <Card className="@container/plan gap-0 py-0">
          <div className="flex min-h-[47px] flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-1.5">
            <CardTitle asChild>
              <h2 id={headingId}>{t("plan.title")}</h2>
            </CardTitle>
            <TabsList scrollable>
              {BUCKETS.map((bucket) => (
                <TabsTrigger key={bucket} value={bucket}>
                  <span>{t(`bucketTabs.${bucket}`)}</span>
                  <span className="numeric font-normal text-muted-foreground">
                    {audit.recommendations[bucket].length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {BUCKETS.map((bucket) => (
            <BucketPanel
              key={bucket}
              appId={appId}
              bucket={bucket}
              recommendations={audit.recommendations}
              unanswered={unanswered}
            />
          ))}
          <CardFooter>
            <span>{planNote(audit.recommendations, t)}</span>
          </CardFooter>
        </Card>
      </Tabs>
    </section>
  );
}
