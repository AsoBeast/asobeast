"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  API_TOKEN_SCOPES,
  DEFAULT_API_TOKEN_SCOPE,
  type ApiTokenCreated,
  type ApiTokenScope,
} from "@asobeast/shared";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, createApiToken, deleteApiToken } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import { apiTokensOptions, invalidateApiTokenMutation } from "@/lib/queries";
import { useAuth } from "@/components/auth/use-auth";

const NEVER_EXPIRES = "never";

const EXPIRY_CHOICES = [
  { value: NEVER_EXPIRES, label: "Never expires" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "365 days" },
];

const SCOPE_LABELS: Record<ApiTokenScope, string> = {
  read: "Read only",
  write: "Read and write",
};

function TokenSecret({
  created,
  onDone,
}: {
  created: ApiTokenCreated;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (!navigator.clipboard) {
        throw new Error("clipboard unavailable");
      }
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
      toast.success("Token copied");
    } catch {
      toast.error("Copy failed — select the token above and copy it manually.");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Copy your token</DialogTitle>
        <DialogDescription>
          This is the only time the token is shown. Store it somewhere safe —
          you will not see it again.
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={created.token}
            aria-label="New api token"
            className="font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Copy token"
            onClick={() => void copy()}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" onClick={onDone}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}

function TokenForm({ onCreated }: { onCreated: (t: ApiTokenCreated) => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<ApiTokenScope>(DEFAULT_API_TOKEN_SCOPE);
  const [expiry, setExpiry] = useState(NEVER_EXPIRES);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createApiToken({
        name: name.trim(),
        scope,
        ...(expiry === NEVER_EXPIRES ? {} : { expiresInDays: Number(expiry) }),
      }),
    onSuccess: (result) => {
      invalidateApiTokenMutation(queryClient);
      onCreated(result);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.envelope.message
          : "Could not create the token.",
      );
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (name.trim() === "") {
      setError("Give the token a name.");
      return;
    }
    mutation.mutate();
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>New API token</DialogTitle>
        <DialogDescription>
          Use a token to authenticate scripts and the MCP server with a Bearer
          header. Limits are per workspace, so a second token adds no capacity.
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div className="flex flex-col gap-2">
          <Label htmlFor="token-name">Name</Label>
          <Input
            id="token-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Local script"
            aria-invalid={error !== null}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="token-scope">Scope</Label>
          <Select
            value={scope}
            onValueChange={(next) => setScope(next as ApiTokenScope)}
          >
            <SelectTrigger id="token-scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {API_TOKEN_SCOPES.map((option) => (
                <SelectItem key={option} value={option}>
                  {SCOPE_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Read only is the safer default and is all the MCP server needs.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="token-expiry">Expiry</Label>
          <Select value={expiry} onValueChange={setExpiry}>
            <SelectTrigger id="token-expiry">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPIRY_CHOICES.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </DialogBody>
      <DialogFooter>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
          Create token
        </Button>
      </DialogFooter>
    </form>
  );
}

function CreateTokenDialog() {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<ApiTokenCreated | null>(null);

  function reset(next: boolean) {
    setOpen(next);
    if (!next) setCreated(null);
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          New token
        </Button>
      </DialogTrigger>
      <DialogContent>
        {created ? (
          <TokenSecret created={created} onDone={() => reset(false)} />
        ) : (
          <TokenForm onCreated={setCreated} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RevokeTokenButton({ id, name }: { id: string; name: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const revoke = useMutation({
    mutationFn: () => deleteApiToken(id),
    onSuccess: () => {
      invalidateApiTokenMutation(queryClient);
      setOpen(false);
      toast.success("Token revoked");
    },
    onError: () => toast.error("Could not revoke the token"),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Revoke ${name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke this token?</AlertDialogTitle>
          <AlertDialogDescription>
            Anything using {name} will stop authenticating immediately. This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={revoke.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={revoke.isPending}
            onClick={(event) => {
              event.preventDefault();
              revoke.mutate();
            }}
          >
            {revoke.isPending ? "Revoking…" : "Revoke"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ApiTokensCard() {
  const { status, isLoading } = useAuth();
  const authenticated = Boolean(status?.authenticated);
  const { data } = useQuery({ ...apiTokensOptions, enabled: authenticated });

  if (isLoading || !status?.authenticated) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardDescription>Automation</CardDescription>
          <CardTitle>API tokens</CardTitle>
        </div>
        <CreateTokenDialog />
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No tokens yet. Create one to authenticate scripts or the MCP server
            with a Bearer header.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableCaption className="sr-only">
                Personal API tokens for automation.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead className="numeric text-right">Requests</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell className="max-w-48 truncate font-medium">
                      {token.name}
                    </TableCell>
                    <TableCell
                      translate="no"
                      className="numeric font-mono text-xs text-muted-foreground"
                    >
                      {token.prefix}…
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {SCOPE_LABELS[token.scope]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {token.expiresAt === null ? (
                        <span className="text-muted-foreground">Never</span>
                      ) : token.expired ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : (
                        formatDate(token.expiresAt)
                      )}
                    </TableCell>
                    <TableCell>{formatDate(token.lastUsedAt)}</TableCell>
                    <TableCell className="numeric text-right">
                      {formatNumber(token.usageCount)}
                    </TableCell>
                    <TableCell>{formatDate(token.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <RevokeTokenButton id={token.id} name={token.name} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
