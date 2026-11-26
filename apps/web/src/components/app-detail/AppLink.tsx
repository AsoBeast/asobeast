"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Link2, Link2Off, Loader2, MoreVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { AppDetail, AppGroupMember, Store } from "@asobeast/shared";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { linkApp, unlinkApp, apiErrorMessage } from "@/lib/api";
import { appsOptions, invalidateLinkMutation } from "@/lib/queries";
import { storeLabel } from "@/lib/format";
import { useSingleFlight } from "@/lib/single-flight";

const OTHER_STORE: Record<Store, Store> = {
  APP_STORE: "GOOGLE_PLAY",
  GOOGLE_PLAY: "APP_STORE",
};

export function AppLink({ detail }: { detail: AppDetail }) {
  const counterpart = detail.group?.members.find(
    (member) => member.id !== detail.id,
  );

  if (counterpart) {
    return <LinkedControl appId={detail.id} counterpart={counterpart} />;
  }
  return <LinkTrigger detail={detail} />;
}

function LinkedControl({
  appId,
  counterpart,
}: {
  appId: string;
  counterpart: AppGroupMember;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations("appDetail");
  const tc = useTranslations("common");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const unlink = useMutation({
    mutationFn: () => unlinkApp(appId),
    onSuccess: () => {
      invalidateLinkMutation(queryClient, appId, counterpart.id);
      toast.success(t("link.unlinked"));
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, t("link.unlinkFailed"))),
  });
  const unlinkOnce = useSingleFlight(unlink);

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" asChild>
        <Link href={`/apps/${counterpart.id}`}>
          <AppIcon src={counterpart.iconUrl} size={20} />
          {storeLabel(counterpart.store)}
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("link.options")}>
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setConfirmOpen(true);
            }}
          >
            <Link2Off />
            {t("link.unlink")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("link.unlinkTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.rich("link.unlinkDescription", {
                app: (chunks) => <span translate="no">{chunks}</span>,
                name: counterpart.name ?? t("link.counterpart"),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => unlinkOnce()}>
              {t("link.unlink")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LinkTrigger({ detail }: { detail: AppDetail }) {
  const [open, setOpen] = useState(false);
  const otherStore = OTHER_STORE[detail.store];
  const t = useTranslations("appDetail");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Link2 />
          {t("link.linkListing")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("link.linkListing")}</DialogTitle>
          <DialogDescription>
            {t("link.linkDescription", { store: storeLabel(otherStore) })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Suspense
            fallback={
              <div className="flex items-center gap-2 py-6 text-dense text-muted-foreground">
                <Loader2 className="animate-spin" />
                <span>{t("link.loadingApps")}</span>
              </div>
            }
          >
            <LinkCandidates detail={detail} onLinked={() => setOpen(false)} />
          </Suspense>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function LinkCandidates({
  detail,
  onLinked,
}: {
  detail: AppDetail;
  onLinked: () => void;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations("appDetail");
  const otherStore = OTHER_STORE[detail.store];
  const { data: apps } = useSuspenseQuery(appsOptions);
  const candidates = apps.filter(
    (candidate) => candidate.store === otherStore && candidate.groupId === null,
  );

  const mutation = useMutation({
    mutationFn: (appId: string) => linkApp(detail.id, appId),
    onSuccess: (_group, appId) => {
      invalidateLinkMutation(queryClient, detail.id, appId);
      toast.success(t("link.linked"));
      onLinked();
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, t("link.linkFailed"))),
  });
  const linkOnce = useSingleFlight(mutation);

  if (candidates.length === 0) {
    return (
      <p className="text-dense text-muted-foreground">
        {t("link.noCandidates", { store: storeLabel(otherStore) })}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {candidates.map((candidate) => (
        <li key={candidate.id}>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => linkOnce(candidate.id)}
            className="flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors hover:bg-accent disabled:opacity-50"
          >
            <AppIcon src={candidate.iconUrl} size={36} />
            <span className="flex flex-col">
              <span translate="no" className="text-dense font-medium">
                {candidate.name ?? t("untitled")}
              </span>
              <span className="text-caption text-muted-foreground">
                {candidate.country.toUpperCase()}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
