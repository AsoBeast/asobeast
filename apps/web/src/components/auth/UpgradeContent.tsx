"use client";

import { useQuery } from "@tanstack/react-query";
import { BillingWall } from "@/components/billing/BillingWall";
import {
  InlineQueryError,
  failedRead,
} from "@/components/layout/InlineQueryError";
import { PLAN_UNREACHABLE } from "@/lib/plan-choice";
import { accountPlanOptions, billingCatalogOptions } from "@/lib/queries";
import { MemberBilling } from "./MemberBilling";
import { SessionCheck } from "./SessionCheck";
import { useAuth } from "./use-auth";
import { useSignedOutRedirect } from "./use-signed-out-redirect";

export function UpgradeContent() {
  const { user, status, isLoading, isMember, authenticated } = useAuth();
  const signedOut = useSignedOutRedirect(true);
  const planRead = useQuery({
    ...accountPlanOptions,
    enabled: authenticated,
  });
  const catalogRead = useQuery({
    ...billingCatalogOptions,
    enabled: authenticated && !isLoading && !isMember,
  });

  if (isMember) return <MemberBilling plan={planRead.data} />;
  if (
    isLoading ||
    signedOut ||
    (authenticated && (planRead.isPending || catalogRead.isPending))
  ) {
    return (
      <div className="flex justify-center py-12">
        <SessionCheck />
      </div>
    );
  }
  if (failedRead(planRead)) {
    return (
      <div className="flex justify-center py-12">
        <InlineQueryError message={PLAN_UNREACHABLE} read={planRead} />
      </div>
    );
  }

  return (
    <BillingWall
      user={user}
      plan={planRead.data}
      catalog={catalogRead.data}
      catalogRead={failedRead(catalogRead) ? catalogRead : null}
      billing={status?.billing === true}
    />
  );
}
