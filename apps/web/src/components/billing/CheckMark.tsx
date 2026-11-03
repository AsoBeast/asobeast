import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function CheckMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-success-subtle text-success",
        className,
      )}
    >
      <Check className="size-3" />
    </span>
  );
}
