import { AppLocalizationsSkeleton } from "@/components/localizations/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

const FIELD_CARDS = 4;

export function DraftLocalizationSkeleton() {
  return <Skeleton className="h-14 w-72 max-w-full" />;
}

export function MetadataStatusSkeleton() {
  return <Skeleton className="h-5 w-96 max-w-full" />;
}

export function PanelSkeleton({ className }: { className: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex min-h-[47px] items-center border-b border-border px-4">
        <Skeleton className="h-5 w-44" />
      </div>
      <div className="p-4">
        <Skeleton className={className} />
      </div>
    </div>
  );
}

export function ScreenshotCaptionsSkeleton() {
  return <PanelSkeleton className="h-64 w-full" />;
}

export function MetadataAuditSkeleton() {
  return (
    <>
      <div className="grid grid-cols-12 items-start gap-6">
        <div className="col-span-12 grid grid-cols-1 gap-4 @2xl/metadata:grid-cols-2 @5xl/metadata:col-span-8">
          {Array.from({ length: FIELD_CARDS }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-lg" />
          ))}
        </div>
        <div className="col-span-12 @5xl/metadata:col-span-4">
          <PanelSkeleton className="h-40 w-full" />
        </div>
      </div>
      <PanelSkeleton className="h-48 w-full" />
      <AppLocalizationsSkeleton />
    </>
  );
}
