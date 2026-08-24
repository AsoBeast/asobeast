"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { WorkspaceInviteCreated } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { formatDate } from "@/lib/format";
import {
  invalidateWorkspaceTeamMutation,
  workspaceTeamOptions,
} from "@/lib/queries";

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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    mutation.mutate();
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
        {created ? (
          <DialogBody className="gap-2">
            <p className="text-body">
              {created.delivered
                ? `Invitation sent to ${created.email}.`
                : `Email is not configured, so send ${created.email} this link yourself.`}
            </p>
            <code className="rounded-md bg-muted px-2 py-1.5 text-caption break-all">
              {created.acceptPath}
            </code>
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
              <Button type="submit" disabled={mutation.isPending}>
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

export function TeamCard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: team } = useQuery(workspaceTeamOptions);
  const isOwner = user?.role === "owner";

  const revoke = useMutation({
    mutationFn: revokeInvite,
    onSuccess: () => {
      toast.success("Invitation revoked");
      invalidateWorkspaceTeamMutation(queryClient);
    },
    onError: (err) =>
      toast.error(messageOf(err, "Could not revoke the invitation.")),
  });

  const remove = useMutation({
    mutationFn: removeMember,
    onSuccess: () => {
      toast.success("Member removed");
      invalidateWorkspaceTeamMutation(queryClient);
    },
    onError: (err) =>
      toast.error(messageOf(err, "Could not remove the member.")),
  });

  if (!team) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle>Team</CardTitle>
          <CardDescription>
            Everyone who can sign in to this workspace.
          </CardDescription>
        </div>
        {isOwner ? <InviteDialog /> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableCaption>Members of this workspace</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden sm:table-cell">Joined</TableHead>
              {isOwner ? <TableHead className="w-10" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="break-all whitespace-normal">
                  {member.email}
                </TableCell>
                <TableCell className="capitalize">{member.role}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {formatDate(member.createdAt)}
                </TableCell>
                {isOwner ? (
                  <TableCell>
                    {member.role === "owner" ? null : (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${member.email}`}
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(member.id)}
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
          <Table>
            <TableCaption>Invitations waiting to be accepted</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Expires</TableHead>
                {isOwner ? <TableHead className="w-10" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.invites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="break-all whitespace-normal">
                    {invite.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {formatDate(invite.expiresAt)}
                    </Badge>
                  </TableCell>
                  {isOwner ? (
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Revoke the invitation for ${invite.email}`}
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(invite.id)}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}
