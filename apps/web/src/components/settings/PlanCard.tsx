"use client";

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
import { ApiError, openBillingPortal } from "@/lib/api";
import { formatDate, formatNumber, formatPlanLimit } from "@/lib/format";
import { accountPlanOptions } from "@/lib/queries";

const RESOURCES = [
  { key: "apps", label: "Apps" },
  { key: "keywordMarkets", label: "Keyword markets" },
] as const;

function statusLine(plan: AccountPlan): string {
  if (!plan.entitled) {
    return "Your data stays readable and exportable; tracking resumes when you choose a plan.";
  }
  if (plan.plan === "trial" && plan.trialEndsAt) {
    return `Trial active until ${formatDate(plan.trialEndsAt)}.`;
  }
  if (plan.cancelAtPeriodEnd && plan.renewsAt) {
    return `Cancelled. Access continues until ${formatDate(plan.renewsAt)}.`;
  }
  if (plan.renewsAt) {
    return `Renews on ${formatDate(plan.renewsAt)}.`;
  }
  return "Billed monthly until you cancel.";
}

function UsageRow({ label, usage }: { label: string; usage: QuotaUsage }) {
  const ratio =
    usage.limit === null || usage.limit === 0 ? 0 : usage.used / usage.limit;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="font-medium tabular-nums">
          {formatNumber(usage.used)} of {formatPlanLimit(usage.limit)}
        </dd>
      </div>
      <Meter value={ratio} max={1} tone={ratio >= 1 ? "health" : "neutral"} />
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

  return (
    <Button
      variant="outline"
      disabled={portal.isPending}
      onClick={() => portal.mutate()}
    >
      {portal.isPending ? <Loader2 className="animate-spin" /> : null}
      Manage billing
    </Button>
  );
}

export function PlanCard() {
  const { data: plan } = useSuspenseQuery(accountPlanOptions);
  const { user } = useAuth();

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
        <p className="text-body text-muted-foreground">{statusLine(plan)}</p>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-4">
          {RESOURCES.map(({ key, label }) => (
            <UsageRow key={key} label={label} usage={plan.usage[key]} />
          ))}
        </dl>
      </CardContent>
      <CardFooter className="gap-2">
        {plan.upgradeTo ? (
          <Button asChild>
            <Link href={plan.upgradePath}>
              {plan.entitled ? "Upgrade plan" : "Choose a plan"}
            </Link>
          </Button>
        ) : null}
        {user?.role === "owner" && plan.hasBillingAccount ? (
          <ManageBillingButton />
        ) : null}
      </CardFooter>
    </Card>
  );
}
