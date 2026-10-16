"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InlineQueryError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <span role="alert">{message}</span>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw />
        Retry
      </Button>
    </div>
  );
}
