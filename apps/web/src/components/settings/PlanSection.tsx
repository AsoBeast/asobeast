"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlanCard } from "@/components/settings/PlanCard";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { PlanCardSkeleton } from "@/components/settings/skeletons";
import { accountPlanOptions } from "@/lib/queries";

export function PlanSection() {
  const { data: plan } = useQuery(accountPlanOptions);

  if (!plan?.billing) return null;

  return (
    <SettingsSection
      id="plan"
      title="Plan"
      description="The plan this workspace is on and how much of it you are using."
    >
      <Suspense fallback={<PlanCardSkeleton />}>
        <PlanCard />
      </Suspense>
    </SettingsSection>
  );
}
