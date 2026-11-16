import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const FIELDS = ["first", "second"];

function TextLine({ step, width }: { step: string; width: string }) {
  return (
    <div className={step}>
      <Skeleton
        shape="text"
        className={cn("inline-block align-middle", width)}
      />
    </div>
  );
}

export function AuthCardSkeleton() {
  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <TextLine step="text-heading" width="w-28" />
        <TextLine step="text-caption" width="w-56" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {FIELDS.map((field) => (
          <div key={field} className="flex flex-col gap-2">
            <TextLine step="text-label" width="w-16" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-9 w-full" />
      </CardContent>
    </Card>
  );
}
