"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { Check, Copy, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  API_TOKEN_SCOPES,
  DEFAULT_API_TOKEN_SCOPE,
  type ApiTokenCreated,
  type ApiTokenItem,
  type ApiTokenScope,
} from "@asobeast/shared";
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
import { ApiError, createApiToken } from "@/lib/api";
import { armFocusHandoff, useFocusClaim } from "@/lib/focus-handoff";
import { formatDate, formatNumber, pluralize } from "@/lib/format";
import { apiTokensOptions, invalidateApiTokenMutation } from "@/lib/queries";
import { useAuth } from "@/components/auth/use-auth";
import {
  InlineQueryError,
  failedRead,
} from "@/components/layout/InlineQueryError";
import { useSingleFlight } from "@/lib/single-flight";
import { PanelBody, SettingsPanel } from "@/components/settings/SettingsPanel";
import { RevokeTokenButton } from "./RevokeTokenButton";

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

const TOKEN_DONE_FOCUS_KEY = "api-token-done";

function TokenSecret({
  created,
  onDone,
}: {
  created: ApiTokenCreated;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const claimFocus = useFocusClaim(TOKEN_DONE_FOCUS_KEY);

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
        <Button ref={claimFocus} type="button" onClick={onDone}>
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
  const createOnce = useSingleFlight(mutation);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (name.trim() === "") {
      setError("Give the token a name.");
      return;
    }
    armFocusHandoff(TOKEN_DONE_FOCUS_KEY);
    createOnce();
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
            Read only is the safer default. Choose read and write for a script
            that changes data, or for an agent you allow to track keywords,
            manage competitors and update actions.
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
        <Button type="submit" aria-disabled={mutation.isPending || undefined}>
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
        <Button variant="outline" size="sm">
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

const WIDE_ONLY = "hidden sm:table-cell";

function phoneLine(token: ApiTokenItem): string {
  const expiry =
    token.expiresAt === null
      ? "Never expires"
      : `${token.expired ? "Expired" : "Expires"} ${formatDate(token.expiresAt)}`;
  const used = token.lastUsedAt
    ? `last used ${formatDate(token.lastUsedAt)}`
    : "never used";
  return `${expiry} · ${used} · created ${formatDate(token.createdAt)}`;
}

function Expiry({ token }: { token: ApiTokenItem }) {
  if (token.expiresAt === null) {
    return <span className="text-muted-foreground">Never</span>;
  }
  return token.expired ? (
    <Badge variant="destructive">Expired</Badge>
  ) : (
    <span>{formatDate(token.expiresAt)}</span>
  );
}

function LastUsed({ token }: { token: ApiTokenItem }) {
  return token.lastUsedAt ? (
    <span>{formatDate(token.lastUsedAt)}</span>
  ) : (
    <span className="text-muted-foreground">Never</span>
  );
}

function TokenRow({
  token,
  busiest,
}: {
  token: ApiTokenItem;
  busiest: number;
}) {
  const share = busiest === 0 ? 0 : (token.usageCount / busiest) * 100;

  return (
    <TableRow>
      <TableCell className="max-w-48 whitespace-normal">
        <span className="block truncate font-medium">{token.name}</span>
        <span
          translate="no"
          className="block font-mono text-caption text-faint-foreground"
        >
          {`${token.prefix}…`}
        </span>
        <span className="block text-caption text-faint-foreground sm:hidden">
          {phoneLine(token)}
        </span>
      </TableCell>
      <TableCell>
        <span>{SCOPE_LABELS[token.scope]}</span>
      </TableCell>
      <TableCell className={WIDE_ONLY}>
        <Expiry token={token} />
      </TableCell>
      <TableCell className={WIDE_ONLY}>
        <LastUsed token={token} />
        <span className="block text-caption text-faint-foreground">
          {`created ${formatDate(token.createdAt)}`}
        </span>
      </TableCell>
      <TableCell className="numeric text-right">
        <span className="relative inline-block min-w-16 px-2 py-1">
          <span
            aria-hidden
            className="absolute inset-y-0 right-0 rounded-sm bg-chart-tint"
            style={{ inlineSize: `${share}%` }}
          />
          <span className="relative">{formatNumber(token.usageCount)}</span>
        </span>
      </TableCell>
      <TableCell>
        <div className="flex justify-end">
          <RevokeTokenButton id={token.id} name={token.name} />
        </div>
      </TableCell>
    </TableRow>
  );
}

function tokensNote(tokens: ApiTokenItem[]): string {
  const expired = tokens.filter((token) => token.expired).length;
  const count = pluralize(tokens.length, "token");
  return `${expired > 0 ? `${count}, ${expired} expired` : count} · Limits are per workspace, so a second token adds no capacity.`;
}

function TokensTable({ tokens }: { tokens: ApiTokenItem[] }) {
  const busiest = Math.max(0, ...tokens.map((token) => token.usageCount));

  return (
    <Table>
      <TableCaption className="sr-only">
        Personal API tokens for automation.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Scope</TableHead>
          <TableHead className={WIDE_ONLY}>Expires</TableHead>
          <TableHead className={WIDE_ONLY}>Last used</TableHead>
          <TableHead className="numeric text-right">Requests</TableHead>
          <TableHead className="w-0">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tokens.map((token) => (
          <TokenRow key={token.id} token={token} busiest={busiest} />
        ))}
      </TableBody>
    </Table>
  );
}

function TokensBody({ read }: { read: UseQueryResult<ApiTokenItem[]> }) {
  if (failedRead(read)) {
    return (
      <PanelBody>
        <InlineQueryError
          message="API tokens could not be loaded."
          read={read}
        />
      </PanelBody>
    );
  }
  if (!read.data) return null;
  if (read.data.length === 0) {
    return (
      <p className="mx-auto max-w-prose px-(--card-spacing) py-8 text-center text-body text-muted-foreground">
        No tokens yet. Create one to authenticate scripts or the MCP server with
        a Bearer header.
      </p>
    );
  }
  return <TokensTable tokens={read.data} />;
}

export function ApiTokensCard() {
  const { status, isLoading } = useAuth();
  const authenticated = Boolean(status?.authenticated);
  const read = useQuery({ ...apiTokensOptions, enabled: authenticated });

  if (isLoading || !status?.authenticated) return null;

  const tokens = read.data ?? [];

  return (
    <SettingsPanel
      title="API tokens"
      action={<CreateTokenDialog />}
      footer={tokens.length > 0 ? <p>{tokensNote(tokens)}</p> : null}
    >
      <TokensBody read={read} />
    </SettingsPanel>
  );
}
