import type { ReactNode } from "react";
import { LEDE, META_LINE } from "./panel-classes";

const CONTROLS = "flex items-center gap-2";

export function PageHeader({
  title,
  titleHidden = false,
  controls,
  lede,
  meta,
  children,
}: {
  title: string;
  titleHidden?: boolean;
  controls?: ReactNode;
  lede?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  const controlGroup = controls ? (
    <div className={CONTROLS}>{controls}</div>
  ) : null;
  return (
    <div className="flex flex-col gap-2">
      {titleHidden ? (
        <>
          <h2 className="sr-only">{title}</h2>
          {controlGroup}
        </>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <h1 className="text-title text-balance">{title}</h1>
          {controlGroup}
        </div>
      )}
      {lede ? <p className={LEDE}>{lede}</p> : null}
      {meta ? <p className={META_LINE}>{meta}</p> : null}
      {children}
    </div>
  );
}
