import { TopChartsSkeleton } from "@/components/top-charts/skeletons";

export default function Loading() {
  return (
    <div className="page-full flex flex-col gap-6">
      <TopChartsSkeleton />
    </div>
  );
}
