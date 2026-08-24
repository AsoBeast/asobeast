import {
  BudgetCardSkeleton,
  DeliveryCardSkeleton,
  EmailAlertsCardSkeleton,
  WebhooksCardSkeleton,
} from "@/components/settings/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

function SectionSkeleton() {
  return (
    <div className="flex flex-col gap-1">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="page-reading flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex flex-col gap-3">
        <SectionSkeleton />
        <BudgetCardSkeleton />
      </div>
      <div className="flex flex-col gap-3">
        <SectionSkeleton />
        <DeliveryCardSkeleton />
        <WebhooksCardSkeleton />
        <EmailAlertsCardSkeleton />
      </div>
    </div>
  );
}
