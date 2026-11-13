import { cn } from "@/lib/utils";

export function NumberedSteps({
  steps,
  muteLast = false,
  className,
}: {
  steps: readonly string[];
  muteLast?: boolean;
  className?: string;
}) {
  return (
    <ol className={cn("flex list-none flex-col p-0 text-dense", className)}>
      {steps.map((step, index) => (
        <li
          key={step}
          className={cn(
            "grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2",
            muteLast && index === steps.length - 1 && "text-muted-foreground",
          )}
        >
          <span
            aria-hidden
            className="numeric flex size-5 items-center justify-center rounded-md bg-muted text-tick font-medium text-muted-foreground"
          >
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
