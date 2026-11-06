import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";
import { isAbsent, textInSpans, type ParentElement } from "./text-spans";

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-dense font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] duration-150 ease-out outline-none select-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 aria-disabled:opacity-60 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        outline:
          "border-border bg-card text-foreground hover:bg-muted aria-expanded:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent aria-expanded:bg-accent",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "border-border bg-card text-destructive hover:border-destructive hover:bg-signal-down-subtle",
        link: "h-auto px-0 text-foreground underline decoration-faint-foreground underline-offset-4 hover:decoration-foreground",
      },
      size: {
        default:
          "h-[34px] gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-sm px-2 text-label has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2.5 text-label has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xl: "h-11 gap-2 rounded-lg px-6 text-body has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-[34px]",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const slotsOntoItsChild = (element: ParentElement): boolean =>
  element.type === Slot.Root || element.props.asChild === true;

function slottedTextInSpans(child: React.ReactNode): React.ReactNode {
  if (
    !React.isValidElement<ParentElement["props"]>(child) ||
    isAbsent(child.props.children)
  ) {
    return child;
  }
  const children = slotsOntoItsChild(child)
    ? slottedTextInSpans(child.props.children)
    : textInSpans(child.props.children);
  return React.cloneElement(child, undefined, children);
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {asChild ? slottedTextInSpans(children) : textInSpans(children)}
    </Comp>
  );
}

export { Button, buttonVariants };
