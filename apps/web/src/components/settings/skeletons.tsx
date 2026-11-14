import { PANEL_HEADER } from "@/components/layout/panel-classes";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ROW_WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-3/5"];

export function PanelSkeleton({
  title = "w-28",
  action = false,
  rows = 2,
}: {
  title?: string;
  action?: boolean;
  rows?: number;
}) {
  return (
    <Card>
      <CardHeader
        className={`${PANEL_HEADER} flex items-center justify-between`}
      >
        <Skeleton className={`h-5 ${title}`} />
        {action ? <Skeleton className="h-7 w-28" /> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton
            key={index}
            className={`h-4 ${ROW_WIDTHS[index % ROW_WIDTHS.length]}`}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export function SectionHeadingSkeleton() {
  return <Skeleton className="h-5 w-32" />;
}

export function BudgetCardSkeleton() {
  return <PanelSkeleton title="w-44" action rows={5} />;
}

export function PlanCardSkeleton() {
  return <PanelSkeleton title="w-12" action rows={4} />;
}

export function DeliveryCardSkeleton() {
  return <PanelSkeleton title="w-20" action rows={4} />;
}

export function WebhooksCardSkeleton() {
  return <PanelSkeleton title="w-24" action rows={3} />;
}

export function EmailAlertsCardSkeleton() {
  return <PanelSkeleton title="w-16" action rows={3} />;
}

export function SettingsIndexSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-col gap-3 px-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-4 w-24" />
        ))}
      </div>
    </div>
  );
}
