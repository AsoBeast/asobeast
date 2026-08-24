"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Link2, Link2Off, Loader2, MoreVertical } from "lucide-react";
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
import { ApiError, linkApp, unlinkApp } from "@/lib/api";
import { appsOptions, invalidateLinkMutation } from "@/lib/queries";
import { storeLabel } from "@/lib/format";

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
  const [confirmOpen, setConfirmOpen] = useState(false);

  const unlink = useMutation({
    mutationFn: () => unlinkApp(appId),
    onSuccess: () => {
      invalidateLinkMutation(queryClient, appId, counterpart.id);
      toast.success("Unlinked store listing");
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.envelope.message : "Unlink failed",
      ),
  });

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" asChild>
        <Link href={`/apps/${counterpart.id}`}>
          <AppIcon
            src={counterpart.iconUrl}
            name={counterpart.name}
            size={20}
          />
          {storeLabel(counterpart.store)}
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Linked app options">
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
            Unlink
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink store listing?</AlertDialogTitle>
            <AlertDialogDescription>
              {counterpart.name ?? "The counterpart app"} will no longer appear
              as this app’s linked listing. Keywords and rankings are
              unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => unlink.mutate()}>
              Unlink
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Link2 />
          Link store listing
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link store listing</DialogTitle>
          <DialogDescription>
            Pair this app with its {storeLabel(otherStore)} listing to switch
            between them from the header.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Suspense
            fallback={
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="animate-spin" />
                Loading apps…
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
  const otherStore = OTHER_STORE[detail.store];
  const { data: apps } = useSuspenseQuery(appsOptions);
  const candidates = apps.filter(
    (candidate) => candidate.store === otherStore && candidate.groupId === null,
  );

  const mutation = useMutation({
    mutationFn: (appId: string) => linkApp(detail.id, appId),
    onSuccess: (_group, appId) => {
      invalidateLinkMutation(queryClient, detail.id, appId);
      toast.success("Linked store listing");
      onLinked();
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.envelope.message : "Link failed",
      ),
  });

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No unlinked {storeLabel(otherStore)} apps to link. Import one first.
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
            onClick={() => mutation.mutate(candidate.id)}
            className="flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors hover:bg-accent disabled:opacity-50"
          >
            <AppIcon src={candidate.iconUrl} name={candidate.name} size={36} />
            <span className="flex flex-col">
              <span className="text-sm font-medium">
                {candidate.name ?? "Untitled app"}
              </span>
              <span className="text-xs text-muted-foreground">
                {candidate.country.toUpperCase()}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
