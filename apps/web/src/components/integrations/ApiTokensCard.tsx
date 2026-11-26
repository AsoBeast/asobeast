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
import { useTranslations } from "next-intl";
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
import { formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { apiTokensOptions, invalidateApiTokenMutation } from "@/lib/queries";
import { useAuth } from "@/components/auth/use-auth";
import {
  InlineQueryError,
  failedRead,
} from "@/components/layout/InlineQueryError";
import { useSingleFlight } from "@/lib/single-flight";
import { PanelBody, SettingsPanel } from "@/components/settings/SettingsPanel";
import { TokensTable } from "./TokensTable";

const NEVER_EXPIRES = "never";

const TOKEN_DONE_FOCUS_KEY = "api-token-done";

function TokenSecret({
  created,
  onDone,
}: {
  created: ApiTokenCreated;
  onDone: () => void;
}) {
  const t = useTranslations("integrations.tokens");
  const [copied, setCopied] = useState(false);
  const claimFocus = useFocusClaim(TOKEN_DONE_FOCUS_KEY);

  async function copy() {
    try {
      if (!navigator.clipboard) {
        throw new Error("clipboard unavailable");
      }
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("copyTitle")}</DialogTitle>
        <DialogDescription>{t("copyDescription")}</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={created.token}
            aria-label={t("newTokenAria")}
            className="font-mono md:text-caption"
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t("copyToken")}
            onClick={() => void copy()}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button ref={claimFocus} type="button" onClick={onDone}>
          {t("done")}
        </Button>
      </DialogFooter>
    </>
  );
}

function TokenForm({ onCreated }: { onCreated: (t: ApiTokenCreated) => void }) {
  const t = useTranslations("integrations.tokens");
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
        err instanceof ApiError ? err.envelope.message : t("createFailed"),
      );
    },
  });
  const createOnce = useSingleFlight(mutation);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (name.trim() === "") {
      setError(t("nameRequired"));
      return;
    }
    armFocusHandoff(TOKEN_DONE_FOCUS_KEY);
    createOnce();
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t("formTitle")}</DialogTitle>
        <DialogDescription>{t("formDescription")}</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div className="flex flex-col gap-2">
          <Label htmlFor="token-name">{t("name")}</Label>
          <Input
            id="token-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("namePlaceholder")}
            aria-invalid={error !== null}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="token-scope">{t("scope")}</Label>
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
                  {t(option === "read" ? "scopeRead" : "scopeWrite")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-caption text-muted-foreground">{t("scopeHint")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="token-expiry">{t("expiry")}</Label>
          <Select value={expiry} onValueChange={setExpiry}>
            <SelectTrigger id="token-expiry">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                { value: NEVER_EXPIRES, label: t("neverExpires") },
                { value: "30", label: t("days30") },
                { value: "90", label: t("days90") },
                { value: "365", label: t("days365") },
              ].map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error ? <p className="text-dense text-destructive">{error}</p> : null}
      </DialogBody>
      <DialogFooter>
        <Button type="submit" aria-disabled={mutation.isPending || undefined}>
          {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
          {t("create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CreateTokenDialog() {
  const t = useTranslations("integrations.tokens");
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
          {t("newToken")}
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

function tokensNote(
  tokens: ApiTokenItem[],
  t: ReturnType<typeof useTranslations>,
  locale: ReturnType<typeof useAppLocale>,
): string {
  const expired = tokens.filter((token) => token.expired).length;
  const count = t("tokenCount", {
    count: formatNumberInLocale(tokens.length, locale),
  });
  return expired > 0
    ? t("noteExpired", {
        count,
        expired: formatNumberInLocale(expired, locale),
      })
    : t("note", { count });
}

function TokensBody({ read }: { read: UseQueryResult<ApiTokenItem[]> }) {
  const t = useTranslations("integrations.tokens");
  if (failedRead(read)) {
    return (
      <PanelBody>
        <InlineQueryError message={t("loadFailed")} read={read} />
      </PanelBody>
    );
  }
  if (!read.data) return null;
  if (read.data.length === 0) {
    return (
      <p className="mx-auto max-w-prose px-(--card-spacing) py-8 text-center text-body text-muted-foreground">
        {t("empty")}
      </p>
    );
  }
  return <TokensTable tokens={read.data} />;
}

export function ApiTokensCard() {
  const t = useTranslations("integrations.tokens");
  const locale = useAppLocale();
  const { status, isLoading } = useAuth();
  const authenticated = Boolean(status?.authenticated);
  const read = useQuery({ ...apiTokensOptions, enabled: authenticated });

  if (isLoading || !status?.authenticated) return null;

  const tokens = read.data ?? [];

  return (
    <SettingsPanel
      title={t("title")}
      action={<CreateTokenDialog />}
      footer={tokens.length > 0 ? <p>{tokensNote(tokens, t, locale)}</p> : null}
    >
      <TokensBody read={read} />
    </SettingsPanel>
  );
}
