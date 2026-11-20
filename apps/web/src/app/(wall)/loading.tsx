import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto my-auto flex w-full max-w-100 flex-col items-center gap-6">
      <Skeleton className="h-6 w-64 max-w-full" />
      <div className="flex w-full flex-col items-center gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="h-7 w-32" />
    </div>
  );
}
