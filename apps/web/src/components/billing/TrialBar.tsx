import type { ReactNode } from "react";
import type { TrialBarParts } from "@/lib/plan-choice";

export function TrialBar({
  parts,
  label,
  children,
}: {
  parts: TrialBarParts | null;
  label: string;
  children?: ReactNode;
}) {
  if (!parts && !children) return null;

  return (
    <div
      role="region"
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-overlay print:hidden"
    >
      <div className="page-checkout page-gutter flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:py-4 sm:[--gutter:1.5rem]">
        {parts ? (
          <p className="text-subtitle font-normal text-muted-foreground">
            <span>{parts.before}</span>
            <span className="font-medium text-foreground">{parts.free}</span>
            <span>{parts.middle}</span>
            <span className="font-medium text-foreground">{parts.endsOn}</span>
            <span>{parts.after}</span>
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
