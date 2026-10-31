import { useId, type ReactNode } from "react";
import type { SerpEntryItem } from "@asobeast/shared";
import { serpRole, type SerpRole, type SerpViewer } from "./serp-csv";
import { SerpRow } from "./SerpRow";

export function SerpSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col pt-4">
      <h3
        id={headingId}
        className="px-4 pb-1 text-label text-muted-foreground uppercase"
      >
        {heading}
      </h3>
      {children}
    </section>
  );
}

export function SerpList({
  heading,
  entries,
  viewer,
  comparedTo,
  actionsFor,
}: {
  heading: string;
  entries: readonly SerpEntryItem[];
  viewer: SerpViewer;
  comparedTo: string | null;
  actionsFor?: (entry: SerpEntryItem, role: SerpRole) => ReactNode;
}) {
  return (
    <SerpSection heading={heading}>
      <ol start={entries[0]?.position ?? 1} className="flex flex-col">
        {entries.map((entry) => {
          const role = serpRole(entry, viewer);
          return (
            <SerpRow
              key={entry.position}
              entry={entry}
              role={role}
              comparedTo={comparedTo}
              actions={actionsFor?.(entry, role)}
            />
          );
        })}
      </ol>
    </SerpSection>
  );
}
