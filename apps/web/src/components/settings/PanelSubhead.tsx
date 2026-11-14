import type { ReactNode } from "react";

export function PanelSubhead({
  id,
  as: Heading = "h3",
  title,
  count,
  note,
}: {
  id?: string;
  as?: "h3" | "h4" | "p";
  title: ReactNode;
  count?: number;
  note?: string;
}) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 border-y border-t-border border-b-border-subtle px-(--card-spacing) py-2 text-label">
      <Heading id={id} className="min-w-0 text-label">
        <span>{title}</span>
        {count === undefined ? null : (
          <span
            aria-hidden
            className="font-normal text-faint-foreground"
          >{` · ${count}`}</span>
        )}
      </Heading>
      {note ? (
        <span className="text-right font-normal text-faint-foreground">
          {note}
        </span>
      ) : null}
    </div>
  );
}
