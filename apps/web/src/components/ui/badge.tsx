import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "group/badge inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-transparent px-[7px] text-label whitespace-nowrap numeric transition-[color,background-color,border-color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-secondary text-muted-foreground [a]:hover:bg-accent",
        secondary: "bg-secondary text-muted-foreground [a]:hover:bg-accent",
        flat: "bg-secondary text-muted-foreground [a]:hover:bg-accent",
        up: "bg-signal-up-subtle text-signal-up",
        down: "bg-signal-down-subtle text-signal-down",
        destructive: "bg-signal-down-subtle text-destructive",
        success: "bg-success-subtle text-success",
        warning: "bg-warning-subtle text-warning",
        info: "bg-info-subtle text-info",
        outline:
          "border-border text-muted-foreground [a]:hover:bg-muted [a]:hover:text-foreground",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        link: "px-0 text-foreground underline decoration-faint-foreground underline-offset-4 hover:decoration-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
