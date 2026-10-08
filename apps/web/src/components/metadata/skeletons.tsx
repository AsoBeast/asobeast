import { Skeleton } from "@/components/ui/skeleton";

export function StorefrontLocalizationsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function DraftLocalizationSkeleton() {
  return <Skeleton className="h-14 w-72 max-w-full" />;
}

export function ScreenshotCaptionsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

export function MetadataAuditSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 @2xl/metadata:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
      <StorefrontLocalizationsSkeleton />
      <Skeleton className="h-64 w-full rounded-xl" />
    </>
  );
}
