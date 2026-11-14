import {
  DeliveryCardSkeleton,
  EmailAlertsCardSkeleton,
  PanelSkeleton,
  SectionHeadingSkeleton,
  SettingsIndexSkeleton,
  WebhooksCardSkeleton,
} from "@/components/settings/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="@container/settings">
      <div className="mx-auto grid w-full max-w-[59rem] grid-cols-1 gap-x-12 @[59rem]/settings:grid-cols-[11rem_minmax(0,1fr)]">
        <SettingsIndexSkeleton className="hidden @[59rem]/settings:block" />
        <div className="page-reading flex flex-col gap-8">
          <Skeleton className="h-7 w-32" />
          <PanelSkeleton title="w-36" rows={5} />
          <div className="flex flex-col gap-3">
            <SectionHeadingSkeleton />
            <DeliveryCardSkeleton />
            <WebhooksCardSkeleton />
            <EmailAlertsCardSkeleton />
          </div>
          <PanelSkeleton title="w-16" action rows={3} />
          <PanelSkeleton title="w-40" action rows={2} />
        </div>
      </div>
    </div>
  );
}
