"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, stopAppStoreImport } from "@/lib/api";
import { armFocusHandoff, useFocusClaim } from "@/lib/focus-handoff";
import { invalidateStoreImport } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { STORE_IMPORT_FOCUS_KEY } from "./ImportFromStoreButton";

export function StopImportButton({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const claimFocus = useFocusClaim(STORE_IMPORT_FOCUS_KEY);
  const stop = useMutation({
    mutationFn: () => stopAppStoreImport(id),
    onSuccess: () => {
      invalidateStoreImport(queryClient, id);
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : "Could not stop importing",
      ),
  });
  const stopOnce = useSingleFlight(stop);

  return (
    <Button
      ref={claimFocus}
      variant="outline"
      size="sm"
      aria-disabled={stop.isPending || undefined}
      onClick={() => {
        if (stop.isPending) return;
        armFocusHandoff(STORE_IMPORT_FOCUS_KEY);
        stopOnce();
      }}
    >
      {stop.isPending ? <Loader2 className="animate-spin" /> : null}
      Stop importing
    </Button>
  );
}
