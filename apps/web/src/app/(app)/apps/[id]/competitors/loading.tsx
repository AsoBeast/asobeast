import {
  ComparisonMatrixSkeleton,
  DiscoveryCardSkeleton,
  GapCardSkeleton,
  LedeSkeleton,
  StandingCardSkeleton,
  TrackedCardSkeleton,
} from "@/components/competitors/skeletons";

export default function Loading() {
  return (
    <div className="page-full @container/competitors flex flex-col gap-6">
      <LedeSkeleton />
      <div className="grid items-start gap-6 @5xl/competitors:grid-cols-12">
        <div className="min-w-0 @5xl/competitors:col-span-7">
          <TrackedCardSkeleton />
        </div>
        <div className="min-w-0 @5xl/competitors:col-span-5">
          <StandingCardSkeleton />
        </div>
      </div>
      <GapCardSkeleton />
      <DiscoveryCardSkeleton />
      <ComparisonMatrixSkeleton />
    </div>
  );
}
