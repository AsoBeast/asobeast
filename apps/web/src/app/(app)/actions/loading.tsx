import { ActionCenterSkeleton } from "@/components/actions/skeletons";

export default function Loading() {
  return (
    <div className="page-wide flex flex-col gap-6">
      <div className="h-14" />
      <ActionCenterSkeleton />
    </div>
  );
}
