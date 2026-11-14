import { MarketSwitcherSkeleton } from "@/components/app-detail/skeletons";
import {
  MetadataAuditSkeleton,
  MetadataStatusSkeleton,
} from "@/components/metadata/skeletons";

export default function Loading() {
  return (
    <div className="page-wide @container/metadata flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <MetadataStatusSkeleton />
        <MarketSwitcherSkeleton />
      </div>
      <MetadataAuditSkeleton />
    </div>
  );
}
