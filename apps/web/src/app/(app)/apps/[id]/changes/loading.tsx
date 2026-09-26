import {
  ChangeImpactCardSkeleton,
  ChangesCardSkeleton,
} from "@/components/changes/skeletons";

export default function Loading() {
  return (
    <div className="page-wide flex flex-col gap-6">
      <ChangeImpactCardSkeleton />
      <ChangesCardSkeleton />
    </div>
  );
}
