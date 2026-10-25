"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CompetitorItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { DelistedBadge } from "@/components/apps/DelistedBadge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ConfirmActionFooter } from "@/components/ConfirmActionFooter";
import { Badge } from "@/components/ui/badge";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { removeCompetitor } from "@/lib/api";
import { siblingControl, useCloseFocusHandoff } from "@/lib/focus-handoff";
import { invalidateCompetitorMutation } from "@/lib/queries";
import {
  formatNumber,
  formatPrice,
  formatRating,
  storeLabel,
} from "@/lib/format";
import { useSingleFlight } from "@/lib/single-flight";
import { exportCompetitors } from "./competitor-csv";

const REMOVE_CONTROL = 'button[aria-label^="Remove "]';
const COMPETITOR_FIELD = "competitor-search";

const removalSuccessor = (card: HTMLElement | null): HTMLElement | null =>
  siblingControl(card, REMOVE_CONTROL) ??
  document.getElementById(COMPETITOR_FIELD);

function CompetitorCard({
  id,
  competitor,
}: {
  id: string;
  competitor: CompetitorItem;
}) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const { handOff, onCloseAutoFocus } = useCloseFocusHandoff();
  const name = competitor.name ?? "Untitled app";
  const snapshot = competitor.latestSnapshot;

  const mutation = useMutation({
    mutationFn: () => removeCompetitor(id, competitor.id),
    onSuccess: () => {
      invalidateCompetitorMutation(queryClient, id);
      handOff(removalSuccessor(card.current));
      setConfirmOpen(false);
      toast.success(`Removed ${name}`);
    },
    onError: () => {
      toast.error(`Could not remove ${name}`);
    },
  });
  const removeOnce = useSingleFlight(mutation);

  return (
    <Card ref={card} className="gap-0 p-4">
      <div className="flex items-start gap-4">
        <AppIcon src={competitor.iconUrl} name={competitor.name} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-medium">{name}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="w-fit">
                {storeLabel(competitor.store)}
              </Badge>
              {competitor.delistedAt ? (
                <DelistedBadge since={competitor.delistedAt} />
              ) : null}
            </div>
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
              <span>{formatPrice(snapshot.price, snapshot.currency)}</span>
            ) : null}
            {snapshot?.version ? <span>v{snapshot.version}</span> : null}
          </div>
        </div>
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${name}`}
            >
              <Trash2 />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes {name} from the comparison. Its keyword positions
                are recaptured only if you add it back.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ConfirmActionFooter
              pending={mutation.isPending}
              label="Remove"
              pendingLabel="Removing…"
              onConfirm={removeOnce}
            />
          </AlertDialogContent>
        </AlertDialog>
      </div>
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
  const count = competitors.length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-body text-muted-foreground">
          {`${count} tracked ${count === 1 ? "competitor" : "competitors"}`}
        </p>
        <ExportCsvButton
          subject="competitors"
          onClick={() => exportCompetitors(id, competitors)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {competitors.map((competitor) => (
          <CompetitorCard key={competitor.id} id={id} competitor={competitor} />
        ))}
      </div>
    </div>
  );
}
