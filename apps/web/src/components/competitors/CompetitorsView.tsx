"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CollapsedSectionsProvider } from "@/components/layout/CollapsedSections";
import { CollapsibleCard } from "@/components/layout/CollapsibleCard";
import { KNOWN_SECTIONS } from "@/components/layout/known-sections";
import { Skeleton } from "@/components/ui/skeleton";
import { competitorsOptions } from "@/lib/queries";
import { AddCompetitorForm } from "./AddCompetitorForm";
import { BreakdownOpenerProvider } from "./breakdown-opener";
import { ComparisonMatrix } from "./ComparisonMatrix";
import { COMPETITOR_SECTION } from "./competitor-sections";
import { CompetitorLede } from "./CompetitorLede";
import { CompetitorList, TrackedSummary } from "./CompetitorList";
import { DiscoveryPanel } from "./DiscoveryPanel";
import { GapAnalysis } from "./GapAnalysis";
import { SECTION_BODY, SECTION_FOOTER, SECTION_SHEET } from "./section-layout";
import {
  ComparisonMatrixSkeleton,
  CompetitorListSkeleton,
  DiscoveryCardSkeleton,
  LedeSkeleton,
} from "./skeletons";
import { StandingPanel } from "./StandingPanel";

function CompetitorListSection({ id }: { id: string }) {
  const { data: competitors } = useSuspenseQuery(competitorsOptions(id));
  if (competitors.length === 0) return null;
  return <CompetitorList id={id} competitors={competitors} />;
}

function TrackedPanel({ id }: { id: string }) {
  return (
    <CollapsibleCard
      section={COMPETITOR_SECTION.tracked}
      title="Track the apps you rank against"
      actions={<TrackedSummary id={id} />}
    >
      <div className={SECTION_BODY}>
        <Suspense fallback={<Skeleton className="h-9 w-full" />}>
          <AddCompetitorForm id={id} />
        </Suspense>
        <div className={SECTION_SHEET}>
          <Suspense fallback={<CompetitorListSkeleton />}>
            <CompetitorListSection id={id} />
          </Suspense>
          <p className={SECTION_FOOTER}>
            A new competitor gets positions on the next keyword check
          </p>
        </div>
      </div>
    </CollapsibleCard>
  );
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
      <BreakdownOpenerProvider>
        <div className="@container/competitors flex flex-col gap-6">
          <Suspense fallback={<LedeSkeleton />}>
            <CompetitorLede id={id} />
          </Suspense>

          <div className="grid items-start gap-6 @5xl/competitors:grid-cols-12">
            <div className="min-w-0 @5xl/competitors:col-span-7">
              <TrackedPanel id={id} />
            </div>
            <div className="min-w-0 @5xl/competitors:col-span-5">
              <StandingPanel id={id} />
            </div>
          </div>

          <GapAnalysis id={id} />

          <Suspense fallback={<DiscoveryCardSkeleton />}>
            <DiscoveryPanel id={id} />
          </Suspense>

          <Suspense fallback={<ComparisonMatrixSkeleton />}>
            <ComparisonMatrix id={id} />
          </Suspense>
        </div>
      </BreakdownOpenerProvider>
    </CollapsedSectionsProvider>
  );
}
