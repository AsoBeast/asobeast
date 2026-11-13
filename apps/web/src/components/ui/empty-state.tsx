import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center gap-3 py-6 text-center",
        className,
      )}
    >
      <div className="flex max-w-prose flex-col gap-1">
        <p className="text-body font-medium text-foreground">{title}</p>
        {body ? (
          <p className="text-body text-muted-foreground">{body}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
