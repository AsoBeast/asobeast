import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="page-wide flex flex-col gap-8">
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
