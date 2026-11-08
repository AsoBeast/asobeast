"use client";

import { useQuery } from "@tanstack/react-query";
import { BillingWall } from "@/components/billing/BillingWall";
import { accountPlanOptions, billingCatalogOptions } from "@/lib/queries";
import { MemberBilling } from "./MemberBilling";
import { SessionCheck } from "./SessionCheck";
import { useAuth } from "./use-auth";
import { useSignedOutRedirect } from "./use-signed-out-redirect";

export function UpgradeContent() {
  const { user, status, isLoading, isMember, authenticated } = useAuth();
  const signedOut = useSignedOutRedirect(true);
  const { data: plan, isPending: planPending } = useQuery({
    ...accountPlanOptions,
    enabled: authenticated,
  });
  const { data: catalog } = useQuery({
    ...billingCatalogOptions,
    enabled: authenticated && !isLoading && !isMember,
  });

  if (isMember) return <MemberBilling plan={plan} />;
  if (isLoading || signedOut || (authenticated && planPending)) {
    return (
      <div className="flex justify-center py-12">
        <SessionCheck />
      </div>
    );
  }

  return (
    <BillingWall
      user={user}
      plan={plan}
      catalog={catalog}
      billing={status?.billing === true}
    />
  );
}
