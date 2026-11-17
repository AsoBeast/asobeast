import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AuthPanel } from "./AuthCard";

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
    <div className="mx-auto flex w-full max-w-90 flex-col gap-6">
      <div className="text-center">
        <TextLine step="text-title" width="w-40" />
      </div>
      <AuthPanel>
        <div className="flex flex-col gap-4">
          {FIELDS.map((field) => (
            <div key={field} className="flex flex-col gap-2">
              <TextLine step="text-dense leading-none" width="w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <Skeleton className="h-10 w-full" />
        </div>
      </AuthPanel>
    </div>
  );
}
