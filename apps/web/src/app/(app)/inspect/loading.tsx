import { InspectPageSkeleton } from "@/components/keyword-inspections/skeletons";

export default function Loading() {
  return (
    <div className="page-wide @container/inspect flex flex-col gap-6">
      <InspectPageSkeleton />
    </div>
  );
}
