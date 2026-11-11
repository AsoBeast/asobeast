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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-overlay page-gutter print:hidden sm:[--gutter:1.5rem]"
    >
      <div className="page-checkout flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-8 sm:py-4">
        {parts ? (
          <p className="text-heading font-normal text-muted-foreground sm:mr-auto">
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
