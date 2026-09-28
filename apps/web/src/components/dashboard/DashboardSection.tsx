import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DashboardSection({
  id,
  title,
  description,
  toolbar,
  className,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  toolbar?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex min-w-0 flex-col gap-4", className)}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={headingId} className="text-title">
            {title}
          </h2>
          {description ? (
            <p className="text-body text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {toolbar ? (
          <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
