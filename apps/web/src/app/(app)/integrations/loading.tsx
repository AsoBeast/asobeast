import {
  AutomationSkeleton,
  StoreConnectionsSkeleton,
} from "@/components/integrations/skeletons";
import { SectionHeadingSkeleton } from "@/components/settings/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="page-reading flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-5 w-full max-w-md" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex flex-col gap-3">
        <SectionHeadingSkeleton />
        <StoreConnectionsSkeleton />
      </div>
      <div className="flex flex-col gap-3">
        <SectionHeadingSkeleton />
        <AutomationSkeleton />
      </div>
    </div>
  );
}
