import { Fragment, type ReactNode } from "react";
import { textInSpans } from "./text-spans";

export function Separated({ parts }: { parts: ReactNode[] }) {
  return parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 ? <span aria-hidden> · </span> : null}
      {textInSpans(part)}
    </Fragment>
  ));
}
