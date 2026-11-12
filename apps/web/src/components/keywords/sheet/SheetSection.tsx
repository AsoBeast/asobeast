import { useId, type ReactNode } from "react";

export function SheetSection({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3 border-t border-border-subtle px-4 py-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={titleId} className="text-heading">
          {title}
        </h3>
        {aside ? (
          <span className="text-caption text-faint-foreground">{aside}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}
