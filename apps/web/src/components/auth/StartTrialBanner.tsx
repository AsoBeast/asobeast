"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { UPGRADE_PATH } from "@asobeast/shared";
import { startTrialLine } from "@/lib/plan-choice";
import { accountPlanOptions } from "@/lib/queries";

export function StartTrialBanner() {
  const { data: plan } = useQuery(accountPlanOptions);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-muted px-4 py-2 text-body sm:px-6 print:hidden">
      <span>{startTrialLine(plan?.trialOffer)}</span>
      <Link href={UPGRADE_PATH} className="font-medium underline">
        Start free trial
      </Link>
    </div>
  );
}
