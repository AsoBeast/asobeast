import type { ReactNode } from "react";

export interface Fact {
  term: string;
  value: ReactNode;
  identifier?: boolean;
}

export function FactList({ facts }: { facts: Fact[] }) {
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 text-dense">
      {facts.map(({ term, value, identifier }) => (
        <div key={term} className="contents">
          <dt className="text-muted-foreground">{term}</dt>
          <dd
            translate={identifier ? "no" : undefined}
            className={
              identifier
                ? "min-w-0 font-mono text-caption wrap-anywhere"
                : "min-w-0"
            }
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
