"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { AppListItem } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { addCompetitor, ApiError } from "@/lib/api";
import { armFocusHandoff } from "@/lib/focus-handoff";
import {
  invalidateChartMutation,
  invalidateCompetitorMutation,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { competitorFocusKey } from "./chart-actions";

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
  const [open, setOpen] = useState(false);
  const addOnce = useSingleFlight(mutation);
  const add = (appId: string) => {
    armFocusHandoff(competitorFocusKey(storeAppId));
    addOnce(appId);
  };
  const icon = mutation.isPending ? (
    <Loader2 className="animate-spin" aria-hidden />
  ) : (
    <Plus aria-hidden />
  );

  if (apps.length === 0) return null;
  if (apps.length === 1) {
    const [app] = apps;
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Add ${title} to ${app.name ?? "your app"}`}
        aria-busy={mutation.isPending}
        aria-disabled={mutation.isPending || undefined}
        onClick={() => add(app.id)}
      >
        {icon}
      </Button>
    );
  }
  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => setOpen(next && !mutation.isPending)}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Add ${title} as competitor`}
          aria-busy={mutation.isPending}
          aria-disabled={mutation.isPending || undefined}
        >
          {icon}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Add as competitor to</DropdownMenuLabel>
        {apps.map((app) => (
          <DropdownMenuItem key={app.id} onSelect={() => add(app.id)}>
            {app.name ?? app.id}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
