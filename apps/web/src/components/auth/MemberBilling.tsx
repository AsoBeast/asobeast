"use client";

import Link from "next/link";
import type { AccountPlan } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { MEMBER_BILLING_TITLE, memberPlanLine } from "@/lib/plan-choice";
import { AuthCard } from "./AuthCard";

export function MemberBilling({ plan }: { plan: AccountPlan | undefined }) {
  return (
    <AuthCard
      title={MEMBER_BILLING_TITLE}
      description={memberPlanLine(plan)}
      width="wall"
      className="my-auto"
    >
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/">Back to your apps</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings#team">See the workspace team</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
