import type { ReactNode } from "react";
import Link from "next/link";
import type { ActionItem } from "@asobeast/shared";
import { cn } from "@/lib/utils";
import { ACTION_PRIORITY_LABEL, ACTION_PRIORITY_TONE } from "./action-copy";
import { actionHeadline } from "./action-headline";

export function ActionLine({
  item,
  href,
  children,
}: {
  item: ActionItem;
  href: string;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md px-2 py-2 outline-none transition-colors duration-150 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          "pt-0.5 text-tick font-semibold tracking-wide uppercase",
          ACTION_PRIORITY_TONE[item.priority],
        )}
      >
        {ACTION_PRIORITY_LABEL[item.priority]}
      </span>
      <span className="text-body">{actionHeadline(item)}</span>
      {children ? (
        <span className="col-start-2 flex min-w-0 items-center gap-2 text-caption text-muted-foreground">
          {children}
        </span>
      ) : null}
    </Link>
  );
}
