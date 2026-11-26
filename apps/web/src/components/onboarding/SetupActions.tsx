import { CheckCircle2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MessageTranslator } from "@/i18n/translator";

export interface SetupActionsProps {
  ready: boolean;
  failed: boolean;
  completable: boolean;
  hint: string | null;
  onRetry: () => void;
  onDismiss: () => void;
  onComplete: () => void;
}

function statusText(
  { ready, failed, hint }: Pick<SetupActionsProps, "ready" | "failed" | "hint">,
  t: MessageTranslator,
): string | null {
  if (failed) return t("actions.failed");
  if (!ready) return t("actions.loading");
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
  const t = useTranslations("setup");
  const commonT = useTranslations("common");
  const text = statusText(status, t);
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
        {t("actions.dismiss")}
      </Button>
      <Button disabled={!completable} onClick={onComplete}>
        <CheckCircle2 />
        {t("actions.complete")}
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
              {commonT("retry")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
