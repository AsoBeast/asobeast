"use client";

import Link from "next/link";
import type { AccountPlan } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MEMBER_BILLING_TITLE, memberPlanLine } from "@/lib/plan-choice";

export function MemberBilling({ plan }: { plan: AccountPlan | undefined }) {
  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <CardTitle asChild>
          <h1 className="text-display tracking-tight text-balance">
            {MEMBER_BILLING_TITLE}
          </h1>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-body text-muted-foreground">
          {memberPlanLine(plan)}
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button asChild>
          <Link href="/">Back to your apps</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings#team">See the workspace team</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
