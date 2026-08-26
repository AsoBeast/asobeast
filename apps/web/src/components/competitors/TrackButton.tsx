"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addCompetitor, ApiError } from "@/lib/api";
import { invalidateCompetitorMutation } from "@/lib/queries";

export function TrackButton({
  id,
  storeAppId,
  title,
}: {
  id: string;
  storeAppId: string;
  title: string;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => addCompetitor(id, storeAppId),
    onSuccess: (competitor) => {
      invalidateCompetitorMutation(queryClient, id);
      toast.success(`Now tracking ${competitor.name ?? title}`);
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : `Could not track ${title}`,
      );
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
      Track
    </Button>
  );
}
