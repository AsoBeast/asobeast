import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <Icon aria-hidden className="size-6 text-muted-foreground" />
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="text-body font-medium">{title}</p>
        {body ? (
          <p className="max-w-md text-body text-muted-foreground">{body}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
