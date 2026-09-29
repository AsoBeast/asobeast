import { Fragment, type ReactNode } from "react";

export function Separated({ parts }: { parts: ReactNode[] }) {
  return parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 ? <span aria-hidden> · </span> : null}
      {part}
    </Fragment>
  ));
}
