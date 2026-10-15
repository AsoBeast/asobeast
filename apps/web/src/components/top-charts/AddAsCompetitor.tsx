"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { AppListItem } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addCompetitor, ApiError } from "@/lib/api";
import {
  invalidateChartMutation,
  invalidateCompetitorMutation,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";

export function AddAsCompetitor({
  storeAppId,
  title,
  apps,
}: {
  storeAppId: string;
  title: string;
  apps: readonly AppListItem[];
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (appId: string) => addCompetitor(appId, storeAppId),
    onSuccess: (competitor, appId) => {
      invalidateCompetitorMutation(queryClient, appId);
      invalidateChartMutation(queryClient);
      toast.success(`Now tracking ${competitor.name ?? title}`);
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : `Could not track ${title}`,
      ),
  });
  const addOnce = useSingleFlight(mutation);

  if (apps.length === 0) return null;
  if (apps.length === 1) {
    const [app] = apps;
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={mutation.isPending}
        onClick={() => addOnce(app.id)}
      >
        {mutation.isPending ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <Plus aria-hidden />
        )}
        Add to {app.name ?? "your app"}
      </Button>
    );
  }
  return (
    <Select
      value=""
      disabled={mutation.isPending}
      onValueChange={(appId) => addOnce(appId)}
    >
      <SelectTrigger
        size="sm"
        aria-label={`Add ${title} as competitor to`}
        className="w-44"
      >
        <SelectValue placeholder="Add as competitor…" />
      </SelectTrigger>
      <SelectContent>
        {apps.map((app) => (
          <SelectItem key={app.id} value={app.id}>
            {app.name ?? app.id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
