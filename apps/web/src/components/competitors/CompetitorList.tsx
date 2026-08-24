"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CompetitorItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { removeCompetitor } from "@/lib/api";
import { invalidateCompetitorMutation } from "@/lib/queries";
import {
  formatNumber,
  formatPrice,
  formatRating,
  storeLabel,
} from "@/lib/format";

function CompetitorCard({
  id,
  competitor,
}: {
  id: string;
  competitor: CompetitorItem;
}) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const name = competitor.name ?? "Untitled app";
  const snapshot = competitor.latestSnapshot;

  const mutation = useMutation({
    mutationFn: () => removeCompetitor(id, competitor.id),
    onSuccess: () => {
      invalidateCompetitorMutation(queryClient, id);
      setConfirmOpen(false);
      toast.success(`Removed ${name}`);
    },
    onError: () => {
      toast.error(`Could not remove ${name}`);
    },
  });

  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start gap-4">
        <AppIcon src={competitor.iconUrl} name={competitor.name} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-medium">{name}</span>
            <Badge variant="secondary" className="w-fit">
              {storeLabel(competitor.store)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {snapshot?.ratingAvg !== null && snapshot !== null ? (
              <span>
                ★ {formatRating(snapshot.ratingAvg)}
                {snapshot.ratingCount !== null
                  ? ` (${formatNumber(snapshot.ratingCount)})`
                  : ""}
              </span>
            ) : null}
            {snapshot?.price !== null && snapshot !== null ? (
              <span>{formatPrice(snapshot.price)}</span>
            ) : null}
            {snapshot?.version ? <span>v{snapshot.version}</span> : null}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${name}`}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 />
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {name} from the comparison. Its keyword positions are
              recaptured only if you add it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={mutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                mutation.mutate();
              }}
            >
              {mutation.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function CompetitorList({
  id,
  competitors,
}: {
  id: string;
  competitors: CompetitorItem[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {competitors.map((competitor) => (
        <CompetitorCard key={competitor.id} id={id} competitor={competitor} />
      ))}
    </div>
  );
}
