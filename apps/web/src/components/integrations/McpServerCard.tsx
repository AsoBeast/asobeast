"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Plug } from "lucide-react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { ApiTokenCreated } from "@asobeast/shared";
import { FOOTER_LINK } from "@/components/layout/panel-classes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PanelBody, SettingsPanel } from "@/components/settings/SettingsPanel";
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
import { armFocusHandoff, useFocusClaim } from "@/lib/focus-handoff";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MCP_CLIENTS,
  hostedSnippets,
  isMcpClient,
  localSnippets,
  remoteEndpoint,
  snippetsFor,
  type ConnectSnippet,
} from "@/lib/mcp-snippets";
import { mcpClientParser } from "@/lib/search-params";
import { invalidateApiTokenMutation } from "@/lib/queries";
import { useAuth } from "@/components/auth/use-auth";
import { useSingleFlight } from "@/lib/single-flight";
import { mcpTokenScope } from "@/lib/mcp-token-scope";

const DOCS_URL = "https://docs.asobeast.com/mcp/setup";

function CopyBlock({ snippet }: { snippet: ConnectSnippet }) {
  const t = useTranslations("integrations.mcp");
  const { label, location, value } = snippet;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(t("copied", { label }));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-label">{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t("copyAria", { label })}
          onClick={() => void copy()}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      <p className="text-caption text-muted-foreground">{location}</p>
      <pre className="overflow-x-auto rounded-lg border bg-muted p-3 font-mono text-caption">
        {value}
      </pre>
    </div>
  );
}

function AgentSnippets({
  id,
  snippets,
}: {
  id: string;
  snippets: ConnectSnippet[];
}) {
  const t = useTranslations("integrations.mcp");
  const [selected, setSelected] = useQueryState("agent", mcpClientParser);
  const clients = MCP_CLIENTS.filter(
    (candidate) => snippetsFor(snippets, candidate).length > 0,
  );
  const client = clients.includes(selected)
    ? selected
    : (clients[0] ?? selected);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>{t("agent")}</Label>
        <Select
          value={client}
          onValueChange={(next) => {
            if (isMcpClient(next)) void setSelected(next);
          }}
        >
          <SelectTrigger id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {clients.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {snippetsFor(snippets, client).map((snippet) => (
        <CopyBlock key={snippet.id} snippet={snippet} />
      ))}
    </>
  );
}

function ConnectionSnippets({ token }: { token: string }) {
  const t = useTranslations("integrations.mcp");
  return (
    <Tabs defaultValue="remote">
      <TabsList>
        <TabsTrigger value="remote">{t("hostedEndpoint")}</TabsTrigger>
        <TabsTrigger value="stdio">{t("localServer")}</TabsTrigger>
      </TabsList>
      <TabsContent value="remote" className="flex flex-col gap-4">
        <p className="text-dense text-muted-foreground">
          {t("hostedDescription")}
        </p>
        <AgentSnippets id="mcp-hosted-agent" snippets={hostedSnippets(token)} />
      </TabsContent>
      <TabsContent value="stdio" className="flex flex-col gap-4">
        <p className="text-dense text-muted-foreground">
          {t("localDescription")}
        </p>
        <AgentSnippets id="mcp-local-agent" snippets={localSnippets(token)} />
      </TabsContent>
    </Tabs>
  );
}

const MINTED_DONE_FOCUS_KEY = "mcp-token-done";

function ConnectDialog() {
  const t = useTranslations("integrations.mcp");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<ApiTokenCreated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allowChanges, setAllowChanges] = useState(false);
  const claimFocus = useFocusClaim(MINTED_DONE_FOCUS_KEY);

  const mutation = useMutation({
    mutationFn: () =>
      createApiToken({
        name: name.trim(),
        scope: mcpTokenScope(allowChanges),
      }),
    onSuccess: (result) => {
      invalidateApiTokenMutation(queryClient);
      setCreated(result);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.envelope.message : t("createFailed"),
      );
    },
  });
  const createOnce = useSingleFlight(mutation);

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setName("");
      setAllowChanges(false);
      setCreated(null);
      setError(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (name.trim() === "") {
      setError(t("nameRequired"));
      return;
    }
    armFocusHandoff(MINTED_DONE_FOCUS_KEY);
    createOnce();
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plug />
          {t("connectAgent")}
        </Button>
      </DialogTrigger>
      <DialogContent size={created ? "lg" : "default"}>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("connectedTitle")}</DialogTitle>
              <DialogDescription>
                {t(
                  created.scope === "write"
                    ? "tokenNoticeWrite"
                    : "tokenNoticeRead",
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <ConnectionSnippets token={created.token} />
            </DialogBody>
            <DialogFooter>
              <Button
                ref={claimFocus}
                type="button"
                onClick={() => reset(false)}
              >
                {t("done")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t("connectTitle")}</DialogTitle>
              <DialogDescription>{t("connectDescription")}</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="flex flex-col gap-2">
                <Label htmlFor="mcp-token-name">{t("tokenName")}</Label>
                <Input
                  id="mcp-token-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("tokenPlaceholder")}
                  aria-invalid={error !== null}
                />
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="mcp-allow-changes"
                  checked={allowChanges}
                  onCheckedChange={(checked) =>
                    setAllowChanges(checked === true)
                  }
                  aria-describedby="mcp-allow-changes-hint"
                  className="mt-0.5"
                />
                <div className="flex flex-col gap-1">
                  <Label htmlFor="mcp-allow-changes">{t("allowChanges")}</Label>
                  <p
                    id="mcp-allow-changes-hint"
                    className="text-caption text-muted-foreground"
                  >
                    {t("changesHint")}
                  </p>
                </div>
              </div>
              {error ? (
                <p className="text-dense text-destructive">{error}</p>
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
                {t("mintToken")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EndpointField() {
  const t = useTranslations("integrations.mcp");
  const endpoint = remoteEndpoint();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(endpoint);
      setCopied(true);
      toast.success(t("endpointCopied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-label">{t("endpoint")}</span>
      <div className="flex min-w-0 items-center gap-2 rounded-md border bg-muted py-1 pr-1 pl-3">
        <code
          translate="no"
          className="min-w-0 flex-1 py-1 font-mono text-caption wrap-anywhere"
        >
          {endpoint}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t("copyEndpoint")}
          onClick={() => void copy()}
        >
          {copied ? <Check /> : <Copy />}
          {t("copy")}
        </Button>
      </div>
    </div>
  );
}

export function McpServerCard() {
  const t = useTranslations("integrations.mcp");
  const { status, isLoading } = useAuth();

  if (isLoading || !status?.authenticated) return null;

  return (
    <SettingsPanel
      title={t("title")}
      action={<ConnectDialog />}
      footer={
        <>
          <p className="min-w-0 flex-1 basis-64">{t("footer")}</p>
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className={FOOTER_LINK}
          >
            {t("readGuide")}
          </a>
        </>
      }
    >
      <PanelBody className="gap-4">
        <p className="max-w-[70ch] text-body text-muted-foreground">
          {t("description")}
        </p>
        <EndpointField />
      </PanelBody>
    </SettingsPanel>
  );
}
