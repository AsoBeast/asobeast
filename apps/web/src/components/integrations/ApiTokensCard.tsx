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
import { ApiError, createApiToken } from "@/lib/api";
import { armFocusHandoff, useFocusClaim } from "@/lib/focus-handoff";
import { pluralize } from "@/lib/format";
import { apiTokensOptions, invalidateApiTokenMutation } from "@/lib/queries";
import { useAuth } from "@/components/auth/use-auth";
import {
  InlineQueryError,
  failedRead,
} from "@/components/layout/InlineQueryError";
import { useSingleFlight } from "@/lib/single-flight";
import { PanelBody, SettingsPanel } from "@/components/settings/SettingsPanel";
import { SCOPE_LABELS } from "./token-scopes";
import { TokensTable } from "./TokensTable";

const NEVER_EXPIRES = "never";

const EXPIRY_CHOICES = [
  { value: NEVER_EXPIRES, label: "Never expires" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "365 days" },
];

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

function tokensNote(tokens: ApiTokenItem[]): string {
  const expired = tokens.filter((token) => token.expired).length;
  const count = pluralize(tokens.length, "token");
  return `${expired > 0 ? `${count}, ${expired} expired` : count} · Limits are per workspace, so a second token adds no capacity.`;
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
