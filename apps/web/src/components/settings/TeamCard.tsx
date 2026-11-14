"use client";

import { useState } from "react";
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
import { ApiError, inviteMember, removeMember, revokeInvite } from "@/lib/api";
import {
  cardAction,
  siblingControl,
  useFocusAfterCommit,
} from "@/lib/focus-handoff";
import { formatDate, pluralize } from "@/lib/format";
import {
  invalidateWorkspaceTeamMutation,
  workspaceTeamOptions,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { inviteOutcome } from "./invite-outcome";
import { PanelSubhead } from "./PanelSubhead";
import { SettingsPanel } from "./SettingsPanel";
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

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.envelope.message : fallback;
}

function InviteDialog() {
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
    onError: (err) =>
      setError(messageOf(err, "Could not send the invitation.")),
  });
  const inviteOnce = useSingleFlight(mutation);

  const outcome = created ? inviteOutcome(created) : null;

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
          Invite member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>
            They join this workspace and see everything in it except billing.
          </DialogDescription>
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
                <Label htmlFor="invite-email">Email</Label>
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
                Send invitation
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
  return (
    <>
      <PanelSubhead
        title="Invitations"
        count={invites.length}
        note="Waiting to be accepted"
      />
      <Table className="table-fixed">
        <TableCaption className="sr-only">
          Invitations waiting to be accepted
        </TableCaption>
        <TeamColumns isOwner={isOwner} />
        <TableHeader className="sr-only">
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className={DATE_COLUMN}>Expires</TableHead>
            {isOwner ? (
              <TableHead>
                <span className="sr-only">Actions</span>
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
                  {`Expires ${formatDate(invite.expiresAt)}`}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground capitalize">
                <span>{invite.role}</span>
              </TableCell>
              <TableCell className={`${DATE_COLUMN} text-muted-foreground`}>
                <span>{`Expires ${formatDate(invite.expiresAt)}`}</span>
              </TableCell>
              {isOwner ? (
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Revoke the invitation for ${invite.email}`}
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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: team, isPending } = useQuery(workspaceTeamOptions);
  const isOwner = user?.role === "owner";
  const focusAfterCommit = useFocusAfterCommit();

  const revoke = useMutation({
    mutationFn: revokeInvite,
    onSuccess: () => {
      toast.success("Invitation revoked");
      invalidateWorkspaceTeamMutation(queryClient);
    },
    onError: (err) =>
      toast.error(messageOf(err, "Could not revoke the invitation.")),
  });
  const revokeOnce = useSingleFlight(revoke);

  const remove = useMutation({
    mutationFn: removeMember,
    onSuccess: () => {
      toast.success("Member removed");
      invalidateWorkspaceTeamMutation(queryClient);
    },
    onError: (err) =>
      toast.error(messageOf(err, "Could not remove the member.")),
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

  if (isPending) return <PanelSkeleton title="w-16" action rows={3} />;
  if (!team) return null;

  return (
    <SettingsPanel
      as="h2"
      title="Team"
      action={isOwner ? <InviteDialog /> : null}
      footer={
        <p className="numeric">
          {[
            pluralize(team.members.length, "member"),
            ...(team.invites.length > 0
              ? [pluralize(team.invites.length, "invitation")]
              : []),
          ].join(" · ")}
        </p>
      }
    >
      <Table className="table-fixed">
        <TableCaption className="sr-only">
          Members of this workspace
        </TableCaption>
        <TeamColumns isOwner={isOwner} />
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className={DATE_COLUMN}>Joined</TableHead>
            {isOwner ? (
              <TableHead>
                <span className="sr-only">Actions</span>
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
                    <Badge variant="brand">You</Badge>
                  ) : null}
                </span>
              </TableCell>
              <TableCell className="capitalize">
                <span>{member.role}</span>
              </TableCell>
              <TableCell className={DATE_COLUMN}>
                <span>{formatDate(member.createdAt)}</span>
              </TableCell>
              {isOwner ? (
                <TableCell>
                  {member.role === "owner" ? null : (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${member.email}`}
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
