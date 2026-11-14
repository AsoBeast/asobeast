"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AccountPlan, QuotaUsage } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { useAuth } from "@/components/auth/use-auth";
import { KeywordLimitNotice } from "@/components/settings/KeywordLimitNotice";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { ApiError, openBillingPortal } from "@/lib/api";
import {
  MEMBER_BILLING_NOTE,
  planAction,
  planCallToAction,
  planOnSale,
  planStatusLine,
} from "@/lib/plan-choice";
import { aiUsageNote } from "@/lib/ai-allowance";
import { accountPlanOptions, billingCatalogOptions } from "@/lib/queries";
import { formatQuotaUsage, hasNoCapacity } from "@/lib/quota-usage";
import { useSingleFlight } from "@/lib/single-flight";

const RESOURCES = [
  { key: "apps", label: "Apps" },
  { key: "keywordMarkets", label: "Keyword markets" },
] as const;

function UsageRow({
  label,
  usage,
  counted,
  note,
}: {
  label: string;
  usage: QuotaUsage;
  counted?: string;
  note?: string;
}) {
  const ratio =
    usage.limit === null || usage.limit === 0 ? 0 : usage.used / usage.limit;

  return (
    <div className="flex flex-col gap-2 border-b border-border-subtle px-(--card-spacing) py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-4 text-dense">
        <dt>{label}</dt>
        <dd className="numeric font-medium">
          {formatQuotaUsage(usage, counted)}
        </dd>
      </div>
      {hasNoCapacity(usage) ? null : (
        <Meter value={ratio} max={1} tone={ratio >= 1 ? "health" : "neutral"} />
      )}
      {note ? (
        <p className="text-caption text-faint-foreground">{note}</p>
      ) : null}
    </div>
  );
}

function ManageBillingButton() {
  const portal = useMutation({
    mutationFn: openBillingPortal,
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : "Could not open the billing portal. Try again.",
      );
    },
  });
  const portalOnce = useSingleFlight(portal);

  return (
    <Button
      variant="outline"
      size="sm"
      aria-disabled={portal.isPending || undefined}
      onClick={() => portalOnce()}
    >
      {portal.isPending ? <Loader2 className="animate-spin" /> : null}
      Manage billing
    </Button>
  );
}

function BillingActions({ plan }: { plan: AccountPlan }) {
  return (
    <>
      {plan.hasBillingAccount ? <ManageBillingButton /> : null}
      {plan.upgradeTo && planAction(plan, plan.upgradeTo) !== "pending" ? (
        <Button asChild size="sm">
          <Link href={plan.upgradePath}>{planCallToAction(plan)}</Link>
        </Button>
      ) : null}
    </>
  );
}

export function PlanCard() {
  const { data: plan } = useSuspenseQuery(accountPlanOptions);
  const { data: catalog } = useQuery({
    ...billingCatalogOptions,
    enabled: plan.billing,
  });
  const { isMember, isOwner } = useAuth();

  if (!plan.billing) return null;

  return (
    <SettingsPanel
      as="h2"
      title="Plan"
      action={
        <span className="flex items-center gap-2 text-label">
          <span>{plan.displayName}</span>
          {plan.entitled ? null : (
            <Badge variant="destructive">Access paused</Badge>
          )}
        </span>
      }
      footer={
        <>
          <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
            <p>{planStatusLine(planOnSale(plan, catalog) ?? plan)}</p>
            {isMember ? <p>{MEMBER_BILLING_NOTE}</p> : null}
          </div>
          {isOwner ? (
            <div className="flex flex-wrap items-center gap-2">
              <BillingActions plan={plan} />
            </div>
          ) : null}
        </>
      }
    >
      <dl className="flex flex-col">
        {RESOURCES.map(({ key, label }) => (
          <UsageRow key={key} label={label} usage={plan.usage[key]} />
        ))}
        {plan.usage.aiCalls ? (
          <UsageRow
            label="AI calls this month"
            usage={plan.usage.aiCalls}
            counted="used"
            note={aiUsageNote(plan.usage.aiCalls, plan.trialing === true)}
          />
        ) : null}
      </dl>
      <div className="px-(--card-spacing) pb-3 empty:hidden">
        <Suspense fallback={null}>
          <KeywordLimitNotice />
        </Suspense>
      </div>
    </SettingsPanel>
  );
}
