import { MetadataAuditSkeleton } from "@/components/metadata/skeletons";

export default function Loading() {
  return (
    <div className="page-wide @container/metadata flex flex-col gap-8">
      <MetadataAuditSkeleton />
    </div>
  );
}
