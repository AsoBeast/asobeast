"use client";

import * as React from "react";

import { useOverflowing } from "@/lib/scroll-overflow";
import { cn } from "@/lib/utils";

function assignRef<T>(ref: React.Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") ref(node);
  else if (ref) ref.current = node;
}

function Table({
  className,
  containerClassName,
  containerRef,
  scrollLabel,
  scrollFocus = "always",
  ...props
}: React.ComponentProps<"table"> & {
  containerClassName?: string;
  containerRef?: React.Ref<HTMLDivElement>;
  scrollLabel?: string;
  scrollFocus?: "always" | "overflow";
}) {
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null);
  const overflowing = useOverflowing(container);
  const attach = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (scrollFocus === "overflow") setContainer(node);
      assignRef(containerRef, node);
    },
    [containerRef, scrollFocus],
  );
  const keyboardScrolls = scrollFocus === "always" || overflowing;

  return (
    <div
      ref={attach}
      {...(scrollLabel && keyboardScrolls
        ? { role: "region", "aria-label": scrollLabel, tabIndex: 0 }
        : {})}
      data-slot="table-container"
      className={cn(
        "relative w-full overflow-x-auto overscroll-x-contain",
        containerClassName,
      )}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b bg-card transition-colors hover:bg-muted has-aria-expanded:bg-muted data-[state=selected]:bg-accent",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-9 px-2 text-left align-middle text-label font-medium whitespace-nowrap text-muted-foreground uppercase [&_button]:uppercase [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-2 py-1.5 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
