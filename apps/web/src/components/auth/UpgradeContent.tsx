"use client";

import { useQuery } from "@tanstack/react-query";
import { BillingWall } from "@/components/billing/BillingWall";
import {
  InlineQueryError,
  failedRead,
  type RetryableRead,
} from "@/components/layout/InlineQueryError";
import { PLAN_UNREACHABLE } from "@/lib/plan-choice";
import { accountPlanOptions, billingCatalogOptions } from "@/lib/queries";
import { MemberBilling } from "./MemberBilling";
import { SessionCheck } from "./SessionCheck";
import { useAuth } from "./use-auth";
import { useSignedOutRedirect } from "./use-signed-out-redirect";

function firstLoad(read: RetryableRead & { isPending: boolean }): boolean {
  return read.isPending && !failedRead(read);
}

function CheckingSession() {
  return (
    <div className="flex justify-center py-12">
      <SessionCheck />
    </div>
  );
}

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
  if (isLoading || signedOut) return <CheckingSession />;
  if (failedRead(planRead)) {
    return (
      <div className="flex justify-center py-12">
        <InlineQueryError message={PLAN_UNREACHABLE} read={planRead} />
      </div>
    );
  }
  if (authenticated && (firstLoad(planRead) || firstLoad(catalogRead))) {
    return <CheckingSession />;
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
