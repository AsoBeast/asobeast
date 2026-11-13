import type { ReactNode } from "react";
import Link from "next/link";
import type { ActionItem } from "@asobeast/shared";
import { cn } from "@/lib/utils";
import { actionHeadline } from "./action-headline";
import { PRIORITY_COLUMNS, PriorityWord } from "./PriorityWord";

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
      className={cn(
        "grid gap-x-3 gap-y-1 rounded-md px-2 py-2 outline-none transition-colors duration-150 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        PRIORITY_COLUMNS,
      )}
    >
      <PriorityWord priority={item.priority} />
      <span className="text-body">{actionHeadline(item)}</span>
      {children ? (
        <span className="col-start-2 flex min-w-0 items-center gap-2 text-caption text-muted-foreground">
          {children}
        </span>
      ) : null}
    </Link>
  );
}
