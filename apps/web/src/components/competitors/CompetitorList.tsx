"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  closeUnlessPending,
  ConfirmActionFooter,
} from "@/components/ConfirmActionFooter";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { PANEL_COUNT } from "@/components/layout/panel-classes";
import { Button } from "@/components/ui/button";
import { Separated } from "@/components/ui/separated";
import { removeCompetitor } from "@/lib/api";
import { siblingControl, useCloseFocusHandoff } from "@/lib/focus-handoff";
import {
  competitorsOptions,
  invalidateCompetitorMutation,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { exportCompetitors } from "./competitor-csv";
import { snapshotParts } from "./competitor-snapshot";

const REMOVE_CONTROL = 'button[aria-label^="Remove "]';
const COMPETITOR_FIELD = "competitor-search";

const removalSuccessor = (row: HTMLElement | null): HTMLElement | null =>
  siblingControl(row, REMOVE_CONTROL) ??
  document.getElementById(COMPETITOR_FIELD);

function CompetitorRow({
  id,
  competitor,
}: {
  id: string;
  competitor: CompetitorItem;
}) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const row = useRef<HTMLLIElement>(null);
  const { handOff, onCloseAutoFocus } = useCloseFocusHandoff();
  const name = competitor.name ?? "Untitled app";

  const mutation = useMutation({
    mutationFn: () => removeCompetitor(id, competitor.id),
    onSuccess: () => {
      invalidateCompetitorMutation(queryClient, id);
      handOff(removalSuccessor(row.current));
      setConfirmOpen(false);
      toast.success(`Removed ${name}`);
    },
    onError: () => {
      toast.error(`Could not remove ${name}`);
    },
  });
  const removeOnce = useSingleFlight(mutation);

  return (
    <li
      ref={row}
      className="flex min-h-11 items-center gap-3 border-b border-border-subtle py-1 pr-2 pl-(--card-spacing) last:border-b-0"
    >
      <AppIcon src={competitor.iconUrl} size={24} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <bdi className="truncate text-dense font-medium">{name}</bdi>
          {competitor.delistedAt ? (
            <DelistedBadge since={competitor.delistedAt} />
          ) : null}
        </span>
        <span className="numeric truncate text-caption text-faint-foreground">
          <Separated parts={snapshotParts(competitor.latestSnapshot)} />
        </span>
      </div>
      <AlertDialog
        open={confirmOpen}
        onOpenChange={closeUnlessPending(mutation.isPending, setConfirmOpen)}
      >
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Remove ${name}`}>
            <Trash2 />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {name} from the comparison. Its keyword positions are
              recaptured only if you add it back.
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
    </li>
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
    <ul aria-label="Tracked competitors">
      {competitors.map((competitor) => (
        <CompetitorRow key={competitor.id} id={id} competitor={competitor} />
      ))}
    </ul>
  );
}

export function TrackedSummary({ id }: { id: string }) {
  const { data: competitors } = useQuery(competitorsOptions(id));
  if (competitors === undefined || competitors.length === 0) return null;
  return (
    <>
      <span className={PANEL_COUNT}>{`${competitors.length} tracked`}</span>
      <ExportCsvButton
        subject="competitors"
        onClick={() => exportCompetitors(id, competitors)}
      />
    </>
  );
}
