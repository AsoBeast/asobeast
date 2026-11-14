"use client";

import { Fragment } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { storeConnectionsOptions } from "@/lib/queries";
import { connectionSummary, type SummaryPart } from "./connection-summary";

const FIGURE = "numeric font-medium text-foreground";

function Part({ part }: { part: SummaryPart }) {
  if (part.warning) {
    return <span className="font-medium text-warning">{part.text}</span>;
  }
  const figure = part.figure ? (
    <span className={FIGURE}>{part.figure}</span>
  ) : null;
  return (
    <span>
      {part.after ? null : figure}
      <span>{part.after ? `${part.text} ` : ` ${part.text}`}</span>
      {part.after ? figure : null}
    </span>
  );
}

export function IntegrationsStatus() {
  const { data } = useSuspenseQuery(storeConnectionsOptions);
  const parts = connectionSummary(data);
  if (!parts) return null;

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={part.text}>
          {index > 0 ? <span aria-hidden> · </span> : null}
          <Part part={part} />
        </Fragment>
      ))}
    </>
  );
}
