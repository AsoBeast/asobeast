import { cn } from "@/lib/utils";

function Skeleton({
  className,
  shape = "block",
  ...props
}: React.ComponentProps<"div"> & { shape?: "block" | "text" | "circle" }) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse bg-muted",
        shape === "circle" && "aspect-square rounded-full",
        shape === "text" && "h-[1em] rounded-sm",
        shape === "block" && "rounded-md",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
