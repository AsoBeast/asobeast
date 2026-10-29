"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CollapsedSectionsProvider } from "@/components/layout/CollapsedSections";
import { CollapsibleCard } from "@/components/layout/CollapsibleCard";
import { KNOWN_SECTIONS } from "@/components/layout/known-sections";
import { Skeleton } from "@/components/ui/skeleton";
import { competitorsOptions } from "@/lib/queries";
import { AddCompetitorForm } from "./AddCompetitorForm";
import { ComparisonMatrix } from "./ComparisonMatrix";
import { COMPETITOR_SECTION } from "./competitor-sections";
import { CompetitorList } from "./CompetitorList";
import { DiscoveryPanel } from "./DiscoveryPanel";
import {
  ComparisonMatrixSkeleton,
  CompetitorListSkeleton,
  DiscoveryCardSkeleton,
} from "./skeletons";

function CompetitorListSection({ id }: { id: string }) {
  const { data: competitors } = useSuspenseQuery(competitorsOptions(id));
  if (competitors.length === 0) return null;
  return <CompetitorList id={id} competitors={competitors} />;
}

export function CompetitorsView({
  id,
  collapsed,
}: {
  id: string;
  collapsed: readonly string[];
}) {
  return (
    <CollapsedSectionsProvider initial={collapsed} known={KNOWN_SECTIONS}>
      <div className="flex flex-col gap-6">
        <CollapsibleCard
          section={COMPETITOR_SECTION.tracked}
          eyebrow="Competitors"
          title="Track the apps you rank against"
        >
          <div className="flex flex-col gap-6">
            <Suspense fallback={<Skeleton className="h-9 w-full" />}>
              <AddCompetitorForm id={id} />
            </Suspense>
            <Suspense fallback={<CompetitorListSkeleton />}>
              <CompetitorListSection id={id} />
            </Suspense>
          </div>
        </CollapsibleCard>

        <Suspense fallback={<DiscoveryCardSkeleton />}>
          <DiscoveryPanel id={id} />
        </Suspense>

        <Suspense fallback={<ComparisonMatrixSkeleton />}>
          <ComparisonMatrix id={id} />
        </Suspense>
      </div>
    </CollapsedSectionsProvider>
  );
}
