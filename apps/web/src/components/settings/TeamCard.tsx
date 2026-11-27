"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { FormEvent, MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { WorkspaceInviteCreated, WorkspaceTeam } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/components/auth/use-auth";
import {
  InlineQueryError,
  failedRead,
} from "@/components/layout/InlineQueryError";
import {
  inviteMember,
  removeMember,
  revokeInvite,
  apiErrorMessage,
} from "@/lib/api";
import {
  cardAction,
  siblingControl,
  useFocusAfterCommit,
} from "@/lib/focus-handoff";
import { formatDateInLocale } from "@/lib/format";
import {
  invalidateWorkspaceTeamMutation,
  workspaceTeamOptions,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { useAppLocale } from "@/lib/use-app-locale";
import { inviteOutcome } from "./invite-outcome";
import { PanelSubhead } from "./PanelSubhead";
import { PanelBody, SettingsPanel } from "./SettingsPanel";
import { PanelSkeleton } from "./skeletons";

const DATE_COLUMN = "hidden sm:table-cell";

function TeamColumns({ isOwner }: { isOwner: boolean }) {
  return (
    <colgroup>
      <col />
      <col className="w-24 sm:w-32" />
      <col className="hidden w-44 sm:table-column" />
      {isOwner ? <col className="w-14" /> : null}
    </colgroup>
  );
}

function InviteDialog() {
  const t = useTranslations("team");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [created, setCreated] = useState<WorkspaceInviteCreated | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => inviteMember(email.trim()),
    onSuccess: (invite) => {
      setCreated(invite);
      setEmail("");
      invalidateWorkspaceTeamMutation(queryClient);
    },
    onError: (err) => setError(apiErrorMessage(err, t("inviteError"))),
  });
  const inviteOnce = useSingleFlight(mutation);

  const outcome = created ? inviteOutcome(created, t) : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    inviteOnce();
  }

  function change(next: boolean) {
    setOpen(next);
    if (!next) {
      setCreated(null);
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus />
          {t("inviteMember")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("inviteTitle")}</DialogTitle>
          <DialogDescription>{t("inviteDescription")}</DialogDescription>
        </DialogHeader>
        {outcome ? (
          <DialogBody className="gap-2">
            <p className="text-body">{outcome.message}</p>
            {outcome.link ? (
              <code className="rounded-md bg-muted px-2 py-1.5 text-caption break-all">
                {outcome.link}
              </code>
            ) : null}
          </DialogBody>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-col gap-4">
            <DialogBody>
              <div className="flex flex-col gap-2">
                <Label htmlFor="invite-email">{t("email")}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  spellCheck={false}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={error !== null}
                  required
                />
              </div>
              {error ? (
                <p className="text-body text-destructive">{error}</p>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button
                type="submit"
                aria-disabled={mutation.isPending || undefined}
              >
                {mutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                {t("sendInvitation")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Invitations({
  invites,
  isOwner,
  busy,
  onRevoke,
}: {
  invites: WorkspaceTeam["invites"];
  isOwner: boolean;
  busy: boolean;
  onRevoke: (event: MouseEvent<HTMLButtonElement>, id: string) => void;
}) {
  const t = useTranslations("team");
  const locale = useAppLocale();
  return (
    <>
      <PanelSubhead
        title={t("invitations")}
        count={invites.length}
        note={t("waiting")}
      />
      <Table className="table-fixed">
        <TableCaption className="sr-only">
          {t("invitationsCaption")}
        </TableCaption>
        <TeamColumns isOwner={isOwner} />
        <TableHeader className="sr-only">
          <TableRow>
            <TableHead>{t("email")}</TableHead>
            <TableHead>{t("role")}</TableHead>
            <TableHead className={DATE_COLUMN}>{t("expires")}</TableHead>
            {isOwner ? (
              <TableHead>
                <span className="sr-only">{t("actions")}</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {invites.map((invite) => (
            <TableRow key={invite.id}>
              <TableCell className="whitespace-normal">
                <span className="wrap-anywhere">{invite.email}</span>
                <span className="block text-caption text-faint-foreground sm:hidden">
                  {t("expiresOn", {
                    date: formatDateInLocale(invite.expiresAt, locale),
                  })}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground capitalize">
                <span>{t(`roles.${invite.role}`)}</span>
              </TableCell>
              <TableCell className={`${DATE_COLUMN} text-muted-foreground`}>
                <span>
                  {t("expiresOn", {
                    date: formatDateInLocale(invite.expiresAt, locale),
                  })}
                </span>
              </TableCell>
              {isOwner ? (
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t("revokeInvitation", { email: invite.email })}
                    aria-disabled={busy || undefined}
                    onClick={(event) => onRevoke(event, invite.id)}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

export function TeamCard() {
  const t = useTranslations("team");
  const locale = useAppLocale();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const read = useQuery(workspaceTeamOptions);
  const team = read.data;
  const isOwner = user?.role === "owner";
  const focusAfterCommit = useFocusAfterCommit();

  const revoke = useMutation({
    mutationFn: revokeInvite,
    onSuccess: () => {
      toast.success(t("revoked"));
      invalidateWorkspaceTeamMutation(queryClient);
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("revokeError"))),
  });
  const revokeOnce = useSingleFlight(revoke);

  const remove = useMutation({
    mutationFn: removeMember,
    onSuccess: () => {
      toast.success(t("removed"));
      invalidateWorkspaceTeamMutation(queryClient);
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("removeError"))),
  });
  const removeOnce = useSingleFlight(remove);
  const busy = revoke.isPending || remove.isPending;

  function removeRow(event: MouseEvent<HTMLButtonElement>, run: () => void) {
    if (busy) return;
    const control = event.currentTarget;
    focusAfterCommit(
      siblingControl(control.closest("tr"), "button") ?? cardAction(control),
      control,
    );
    run();
  }

  if (!team) {
    if (failedRead(read)) {
      return (
        <SettingsPanel
          as="h2"
          title={t("title")}
          action={isOwner ? <InviteDialog /> : null}
        >
          <PanelBody>
            <InlineQueryError message={t("loadError")} read={read} />
          </PanelBody>
        </SettingsPanel>
      );
    }
    return read.isPending ? (
      <PanelSkeleton title="w-16" action rows={3} />
    ) : null;
  }

  return (
    <SettingsPanel
      as="h2"
      title={t("title")}
      action={isOwner ? <InviteDialog /> : null}
      footer={
        <p className="numeric">
          {[
            t("memberCount", { count: team.members.length }),
            ...(team.invites.length > 0
              ? [t("invitationCount", { count: team.invites.length })]
              : []),
          ].join(" · ")}
        </p>
      }
    >
      <Table className="table-fixed">
        <TableCaption className="sr-only">{t("membersCaption")}</TableCaption>
        <TeamColumns isOwner={isOwner} />
        <TableHeader>
          <TableRow>
            <TableHead>{t("email")}</TableHead>
            <TableHead>{t("role")}</TableHead>
            <TableHead className={DATE_COLUMN}>{t("joined")}</TableHead>
            {isOwner ? (
              <TableHead>
                <span className="sr-only">{t("actions")}</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {team.members.map((member) => (
            <TableRow key={member.id}>
              <TableCell className="whitespace-normal">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 wrap-anywhere">{member.email}</span>
                  {member.email === user?.email ? (
                    <Badge variant="brand">{t("you")}</Badge>
                  ) : null}
                </span>
              </TableCell>
              <TableCell className="capitalize">
                <span>{t(`roles.${member.role}`)}</span>
              </TableCell>
              <TableCell className={DATE_COLUMN}>
                <span>{formatDateInLocale(member.createdAt, locale)}</span>
              </TableCell>
              {isOwner ? (
                <TableCell>
                  {member.role === "owner" ? null : (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t("removeMember", { email: member.email })}
                      aria-disabled={busy || undefined}
                      onClick={(event) =>
                        removeRow(event, () => removeOnce(member.id))
                      }
                    >
                      <Trash2 />
                    </Button>
                  )}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {team.invites.length > 0 ? (
        <Invitations
          invites={team.invites}
          isOwner={isOwner}
          busy={busy}
          onRevoke={(event, id) => removeRow(event, () => revokeOnce(id))}
        />
      ) : null}
    </SettingsPanel>
  );
}
