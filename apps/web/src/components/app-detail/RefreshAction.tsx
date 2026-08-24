"use client";

import { useState } from "react";
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { SnapshotDiffResult } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { ApiError, refreshApp } from "@/lib/api";
import { appKeys } from "@/lib/queries";
import { SnapshotDiffDialog } from "./SnapshotDiffDialog";

export function RefreshAction({ appId }: { appId: string }) {
  const queryClient = useQueryClient();
  const [diff, setDiff] = useState<SnapshotDiffResult | null>(null);
  const busy = useIsMutating({ mutationKey: ["app-action", appId] }) > 0;

  const mutation = useMutation({
    mutationKey: ["app-action", appId, "refresh"],
    mutationFn: () => refreshApp(appId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: appKeys.detail(appId) });
      setDiff(result);
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.envelope.message : "Refresh failed",
      );
    },
  });

  return (
    <>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => mutation.mutate()}
        aria-label="Refresh"
      >
        {mutation.isPending ? (
          <Loader2 className="animate-spin" />
        ) : (
          <RefreshCw />
        )}
        <span className="hidden lg:inline">Refresh</span>
      </Button>
      <SnapshotDiffDialog
        diff={diff}
        open={diff !== null}
        onOpenChange={(open) => {
          if (!open) setDiff(null);
        }}
      />
    </>
  );
}
