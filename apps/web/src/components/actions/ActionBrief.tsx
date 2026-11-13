import { Fragment } from "react";
import type { BriefPart } from "./action-brief";

export function ActionBrief({ parts }: { parts: readonly BriefPart[] }) {
  return parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 ? <span aria-hidden> · </span> : null}
      <span>
        {part.map((segment, at) =>
          typeof segment === "string" ? (
            <span key={at}>{segment}</span>
          ) : (
            <span key={at} className="font-medium text-foreground">
              {segment.strong}
            </span>
          ),
        )}
      </span>
    </Fragment>
  ));
}
