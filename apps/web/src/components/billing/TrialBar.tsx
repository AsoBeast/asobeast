import type { ReactNode } from "react";

export function TrialBar({
  line,
  label,
  children,
}: {
  line: string | null;
  label: string;
  children?: ReactNode;
}) {
  if (!line && !children) return null;

  return (
    <div
      role="region"
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] print:hidden"
    >
      <div className="page-wide page-gutter flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-8 sm:[--gutter:1.5rem]">
        {line ? (
          <p className="text-body text-muted-foreground">{line}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
