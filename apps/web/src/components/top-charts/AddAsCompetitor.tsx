"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
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
import { armFocusHandoff, renewFocusHandoff } from "@/lib/focus-handoff";
import {
  invalidateChartMutation,
  invalidateCompetitorMutation,
} from "@/lib/queries";
import { busyRetry } from "@/lib/query-retry";
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
  const t = useTranslations("topCharts");
  const competitors = useTranslations("competitors");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    ...busyRetry,
    mutationFn: (appId: string) => addCompetitor(appId, storeAppId),
    onSuccess: (competitor, appId) => {
      renewFocusHandoff(competitorFocusKey(storeAppId));
      invalidateCompetitorMutation(queryClient, appId);
      invalidateChartMutation(queryClient);
      toast.success(
        competitors("tracking", { name: competitor.name ?? title }),
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : competitors("trackFailed", { title }),
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
        aria-label={t("row.addTo", {
          title,
          app: app.name ?? t("row.yourApp"),
        })}
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
          aria-label={t("row.addAs", { title })}
          aria-busy={mutation.isPending}
          aria-disabled={mutation.isPending || undefined}
        >
          {icon}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("row.addAsTo")}</DropdownMenuLabel>
        {apps.map((app) => (
          <DropdownMenuItem key={app.id} onSelect={() => add(app.id)}>
            {app.name ?? app.id}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
