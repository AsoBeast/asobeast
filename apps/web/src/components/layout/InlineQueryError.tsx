"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RetryableRead {
  data: unknown;
  isError: boolean;
  isFetching: boolean;
  errorUpdatedAt: number;
  refetch: () => Promise<unknown>;
}

export const failedRead = (read: RetryableRead): boolean =>
  read.data === undefined &&
  (read.isError || (read.isFetching && read.errorUpdatedAt > 0));

export function InlineQueryError({
  message,
  read,
}: {
  message: string;
  read: RetryableRead;
}) {
  const retrying = read.isFetching;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <span role="alert">{message}</span>
      <Button
        size="sm"
        variant="outline"
        aria-disabled={retrying || undefined}
        className="aria-disabled:opacity-60"
        onClick={() => {
          if (!retrying) void read.refetch();
        }}
      >
        <RefreshCw className={cn(retrying && "animate-spin")} />
        Retry
      </Button>
    </div>
  );
}
