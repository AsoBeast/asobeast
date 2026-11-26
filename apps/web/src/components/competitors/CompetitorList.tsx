"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
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
import { formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { siblingControl, useCloseFocusHandoff } from "@/lib/focus-handoff";
import {
  competitorsOptions,
  invalidateCompetitorMutation,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { exportCompetitors } from "./competitor-csv";
import { snapshotParts } from "./competitor-snapshot";

const REMOVE_CONTROL = "button[data-competitor-remove]";
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
  const t = useTranslations("competitors");
  const common = useTranslations("common");
  const locale = useAppLocale();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const row = useRef<HTMLLIElement>(null);
  const { handOff, onCloseAutoFocus } = useCloseFocusHandoff();
  const name = competitor.name ?? t("untitled");

  const mutation = useMutation({
    mutationFn: () => removeCompetitor(id, competitor.id),
    onSuccess: () => {
      invalidateCompetitorMutation(queryClient, id);
      handOff(removalSuccessor(row.current));
      setConfirmOpen(false);
      toast.success(t("list.removed", { name }));
    },
    onError: () => {
      toast.error(t("list.removeFailed", { name }));
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
          <Separated
            parts={snapshotParts(
              competitor.latestSnapshot,
              locale,
              t,
              common("free"),
            )}
          />
        </span>
      </div>
      <AlertDialog
        open={confirmOpen}
        onOpenChange={closeUnlessPending(mutation.isPending, setConfirmOpen)}
      >
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            data-competitor-remove
            aria-label={t("list.remove", { name })}
          >
            <Trash2 />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("list.removeTitle", { name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("list.removeBody", { name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ConfirmActionFooter
            pending={mutation.isPending}
            label={t("list.removeAction")}
            pendingLabel={t("list.removing")}
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
  const t = useTranslations("competitors");
  return (
    <ul aria-label={t("list.aria")}>
      {competitors.map((competitor) => (
        <CompetitorRow key={competitor.id} id={id} competitor={competitor} />
      ))}
    </ul>
  );
}

export function TrackedSummary({ id }: { id: string }) {
  const t = useTranslations("competitors");
  const locale = useAppLocale();
  const { data: competitors } = useQuery(competitorsOptions(id));
  if (competitors === undefined || competitors.length === 0) return null;
  return (
    <>
      <span className={PANEL_COUNT}>
        {t("list.trackedCount", {
          count: formatNumberInLocale(competitors.length, locale),
        })}
      </span>
      <ExportCsvButton
        subject="competitors"
        onClick={() => exportCompetitors(id, competitors, t)}
      />
    </>
  );
}
