import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE = {
  neutral: "text-muted-foreground",
  warning: "text-warning",
  critical: "text-destructive",
} as const;

export type NoticeTone = keyof typeof TONE;

export const NOTICE_LINK =
  "rounded-sm font-medium whitespace-nowrap text-foreground link-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function NoticeLine({
  icon: Icon,
  tone,
  className,
  children,
  ...props
}: {
  icon: LucideIcon;
  tone: NoticeTone;
  children: ReactNode;
} & ComponentProps<"div">) {
  return (
    <div
      data-tone={tone}
      className={cn(
        "flex items-start gap-2 bg-card text-dense text-card-foreground print:hidden",
        className,
      )}
      {...props}
    >
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 size-4 shrink-0", TONE[tone])}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
