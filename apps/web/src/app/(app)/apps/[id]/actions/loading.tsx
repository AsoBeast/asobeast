import { ActionCenterSkeleton } from "@/components/actions/skeletons";

export default function Loading() {
  return (
    <div className="page-wide @container/actions flex flex-col gap-6">
      <ActionCenterSkeleton />
    </div>
  );
}
