"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_API_TOKEN_SCOPE,
  type ApiTokenCreated,
} from "@asobeast/shared";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, createApiToken } from "@/lib/api";
import {
  remoteCommand,
  remoteConfig,
  remoteEndpoint,
  stdioCommand,
  stdioConfig,
} from "@/lib/mcp-snippets";
import { invalidateApiTokenMutation } from "@/lib/queries";
import { useAuth } from "@/components/auth/use-auth";

const DOCS_URL = "https://docs.asobeast.com/mcp/setup";

function CopyBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed — select the text and copy it manually.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium">{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`Copy ${label}`}
          onClick={() => void copy()}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-lg border bg-muted p-3 font-mono text-xs">
        {value}
      </pre>
    </div>
  );
}

function ConnectionSnippets({ token }: { token: string }) {
  return (
    <Tabs defaultValue="remote">
      <TabsList>
        <TabsTrigger value="remote">Hosted endpoint</TabsTrigger>
        <TabsTrigger value="stdio">Local server</TabsTrigger>
      </TabsList>
      <TabsContent value="remote" className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Your client connects straight to this instance. Nothing to install.
        </p>
        <CopyBlock label="Claude Code" value={remoteCommand(token)} />
        <CopyBlock label="Claude Desktop config" value={remoteConfig(token)} />
      </TabsContent>
      <TabsContent value="stdio" className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Run the stdio server yourself, replacing the entrypoint with the
          absolute path to your checkout. The tools are identical.
        </p>
        <CopyBlock label="Claude Code stdio" value={stdioCommand(token)} />
        <CopyBlock
          label="Claude Desktop stdio config"
          value={stdioConfig(token)}
        />
      </TabsContent>
    </Tabs>
  );
}

function ConnectDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<ApiTokenCreated | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createApiToken({ name: name.trim(), scope: DEFAULT_API_TOKEN_SCOPE }),
    onSuccess: (result) => {
      invalidateApiTokenMutation(queryClient);
      setCreated(result);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.envelope.message
          : "Could not create the token.",
      );
    },
  });

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setName("");
      setCreated(null);
      setError(null);
    }
  }

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
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plug />
          Connect an agent
        </Button>
      </DialogTrigger>
      <DialogContent size={created ? "lg" : "default"}>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Connect asobeast</DialogTitle>
              <DialogDescription>
                The token is read-only and is shown once. Copy what you need
                before closing.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <ConnectionSnippets token={created.token} />
            </DialogBody>
            <DialogFooter>
              <Button type="button" onClick={() => reset(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Connect an agent</DialogTitle>
              <DialogDescription>
                Name a token for this agent. We mint it read-only and show you
                the ready-to-paste connect snippets.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="flex flex-col gap-2">
                <Label htmlFor="mcp-token-name">Token name</Label>
                <Input
                  id="mcp-token-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Claude Desktop"
                  aria-invalid={error !== null}
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                Mint token
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function McpServerCard() {
  const { status, isLoading } = useAuth();

  if (isLoading || !status?.authenticated) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardDescription>Automation</CardDescription>
          <CardTitle>MCP server</CardTitle>
        </div>
        <ConnectDialog />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Point Claude Code or Claude Desktop at this instance to ask about your
          apps, keywords, rankings and audits in plain language. Every tool is
          read-only and authenticated with a personal API token.{" "}
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Read the setup guide
          </a>
          .
        </p>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium">Endpoint</Label>
          <code
            translate="no"
            className="block overflow-x-auto rounded-lg border bg-muted px-3 py-2 font-mono text-xs"
          >
            {remoteEndpoint()}
          </code>
        </div>
      </CardContent>
    </Card>
  );
}
