import { CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SetupActionsProps {
  ready: boolean;
  failed: boolean;
  completable: boolean;
  hint: string | null;
  onRetry: () => void;
  onDismiss: () => void;
  onComplete: () => void;
}

function statusText({
  ready,
  failed,
  hint,
}: Pick<SetupActionsProps, "ready" | "failed" | "hint">): string | null {
  if (failed) return "Some live counts could not be loaded.";
  if (!ready) return "Finish loading every live count before completing setup.";
  return hint;
}

export function SetupActions({
  className,
  onRetry,
  onDismiss,
  onComplete,
  completable,
  ...status
}: SetupActionsProps & { className?: string }) {
  const text = statusText(status);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 @4xl/setup:flex-col @4xl/setup:flex-nowrap @4xl/setup:items-stretch",
        className,
      )}
    >
      <Button
        variant="ghost"
        className="@4xl/setup:order-last"
        onClick={onDismiss}
      >
        Dismiss setup
      </Button>
      <Button disabled={!completable} onClick={onComplete}>
        <CheckCircle2 />
        Complete setup
      </Button>
      {text ? (
        <div
          role="status"
          className="flex basis-full flex-wrap items-center justify-end gap-x-3 gap-y-2 text-caption text-muted-foreground @4xl/setup:basis-auto @4xl/setup:justify-start"
        >
          <span>{text}</span>
          {status.failed ? (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw />
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
