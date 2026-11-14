import { PANEL_HEADER } from "@/components/layout/panel-classes";
import { PanelSkeleton } from "@/components/settings/skeletons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function StoreConnectionsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <PanelSkeleton title="w-40" action rows={4} />
      <PanelSkeleton title="w-44" action rows={4} />
    </div>
  );
}

export function AutomationSkeleton() {
  return (
    <>
      <PanelSkeleton title="w-24" action rows={3} />
      <PanelSkeleton title="w-28" action rows={3} />
    </>
  );
}

export function PlaySignInReturnSkeleton() {
  return (
    <Card>
      <CardHeader className={PANEL_HEADER}>
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-4 w-full max-w-sm" />
        <Skeleton className="size-6 rounded-full" />
      </CardContent>
    </Card>
  );
}
