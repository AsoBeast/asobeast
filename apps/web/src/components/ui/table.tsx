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
  density = "default",
  ...props
}: React.ComponentProps<"table"> & {
  density?: "default" | "compact";
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
        data-density={density}
        className={cn("w-full caption-bottom text-dense", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b [&_tr]:border-border", className)}
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
        "border-t border-border bg-card font-medium [&>tr]:last:border-b-0",
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
        "border-b border-border-subtle bg-card transition-colors duration-150 ease-out hover:bg-muted has-aria-expanded:bg-muted data-[state=selected]:bg-accent data-[state=selected]:[&>td:first-child]:shadow-[inset_2px_0_0_var(--foreground)]",
        className,
      )}
      {...props}
    />
  );
}

const NUMERIC_CELL = "text-right numeric";

function TableHead({
  className,
  numeric = false,
  ...props
}: React.ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      data-slot="table-head"
      data-numeric={numeric || undefined}
      className={cn(
        "h-9 px-2 text-left align-middle md:px-4 text-label whitespace-nowrap text-faint-foreground in-data-[density=compact]:h-8 md:in-data-[density=compact]:px-3 [&:has([role=checkbox])]:pr-0",
        numeric && NUMERIC_CELL,
        className,
      )}
      {...props}
    />
  );
}

function TableCell({
  className,
  numeric = false,
  ...props
}: React.ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      data-slot="table-cell"
      data-numeric={numeric || undefined}
      className={cn(
        "h-11 px-2 py-1.5 align-middle md:px-4 whitespace-nowrap in-data-[density=compact]:h-9 md:in-data-[density=compact]:px-3 in-data-[density=compact]:py-1 [&:has([role=checkbox])]:pr-0",
        numeric && NUMERIC_CELL,
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
      className={cn("mt-3 text-caption text-faint-foreground", className)}
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
