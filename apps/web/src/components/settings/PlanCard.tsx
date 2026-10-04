"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AccountPlan, QuotaUsage } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { useAuth } from "@/components/auth/use-auth";
import { KeywordLimitNotice } from "@/components/settings/KeywordLimitNotice";
import { ApiError, openBillingPortal } from "@/lib/api";
import {
  MEMBER_BILLING_NOTE,
  planAction,
  planCallToAction,
  planStatusLine,
} from "@/lib/plan-choice";
import { aiUsageNote } from "@/lib/ai-allowance";
import { accountPlanOptions } from "@/lib/queries";
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="font-medium tabular-nums">
          {formatQuotaUsage(usage, counted)}
        </dd>
      </div>
      {hasNoCapacity(usage) ? null : (
        <Meter value={ratio} max={1} tone={ratio >= 1 ? "health" : "neutral"} />
      )}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
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
      disabled={portal.isPending}
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
      {plan.upgradeTo && planAction(plan, plan.upgradeTo) !== "pending" ? (
        <Button asChild>
          <Link href={plan.upgradePath}>{planCallToAction(plan)}</Link>
        </Button>
      ) : null}
      {plan.hasBillingAccount ? <ManageBillingButton /> : null}
    </>
  );
}

export function PlanCard() {
  const { data: plan } = useSuspenseQuery(accountPlanOptions);
  const { isMember, isOwner, awaitingConfirmation } = useAuth();

  if (!plan.billing) return null;

  return (
    <Card>
      <CardHeader>
        <CardDescription>Plan</CardDescription>
        <CardTitle className="flex items-center gap-2">
          {plan.displayName}
          {plan.entitled ? null : (
            <Badge variant="destructive">Access paused</Badge>
          )}
        </CardTitle>
        <p className="text-body text-muted-foreground">
          {planStatusLine(plan, awaitingConfirmation)}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="flex flex-col gap-4">
          {RESOURCES.map(({ key, label }) => (
            <UsageRow key={key} label={label} usage={plan.usage[key]} />
          ))}
          {plan.usage.aiCalls ? (
            <UsageRow
              label="AI calls this month"
              usage={plan.usage.aiCalls}
              counted="used"
              note={aiUsageNote(plan.usage.aiCalls)}
            />
          ) : null}
        </dl>
        <Suspense fallback={null}>
          <KeywordLimitNotice />
        </Suspense>
      </CardContent>
      <CardFooter className="gap-2">
        {isMember ? (
          <p className="text-body text-muted-foreground">
            {MEMBER_BILLING_NOTE}
          </p>
        ) : null}
        {isOwner ? <BillingActions plan={plan} /> : null}
      </CardFooter>
    </Card>
  );
}
