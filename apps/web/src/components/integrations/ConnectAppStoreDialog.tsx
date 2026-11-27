"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, connectStore } from "@/lib/api";
import { invalidateStoreConnectionMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { CONNECT_GUIDES } from "@/lib/store-connection-copy";
import { AlertChannelDialog } from "@/components/settings/alert-channel/AlertChannelDialog";
import { GuideLink } from "./GuideLink";

const ISSUER_ID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const KEY_ID = /^[A-Za-z0-9]{10}$/;
const PRIVATE_KEY_MARKER = "BEGIN PRIVATE KEY";

function problemOf(
  issuerId: string,
  keyId: string,
  privateKey: string,
  t: ReturnType<typeof useTranslations>,
): string | null {
  if (!ISSUER_ID.test(issuerId)) {
    return t("connectAppStore.issuerRequired");
  }
  if (!KEY_ID.test(keyId)) return t("connectAppStore.keyIdRequired");
  if (!privateKey.includes(PRIVATE_KEY_MARKER)) {
    return t("connectAppStore.privateKeyRequired");
  }
  return null;
}

export function ConnectAppStoreDialog({
  label,
  variant = "outline",
}: {
  label: string;
  variant?: "default" | "outline";
}) {
  const t = useTranslations("integrations");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [issuerId, setIssuerId] = useState("");
  const [keyId, setKeyId] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset(next: boolean) {
    setOpen(next);
    if (next) return;
    setIssuerId("");
    setKeyId("");
    setPrivateKey("");
    setError(null);
  }

  const mutation = useMutation({
    mutationFn: () =>
      connectStore({
        store: "APP_STORE",
        issuerId: issuerId.trim(),
        keyId: keyId.trim(),
        privateKey,
      }),
    onSuccess: () => {
      invalidateStoreConnectionMutation(queryClient);
      toast.success(t("connectAppStore.connected"));
      reset(false);
    },
    onError: (failure) =>
      setError(
        failure instanceof ApiError
          ? failure.envelope.message
          : t("connectAppStore.connectFailed"),
      ),
  });
  const connectOnce = useSingleFlight(mutation);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = problemOf(issuerId.trim(), keyId.trim(), privateKey, t);
    setError(problem);
    if (!problem) connectOnce();
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    setPrivateKey(await file.text());
  }

  return (
    <AlertChannelDialog
      open={open}
      onOpenChange={reset}
      label={label}
      description={
        <>
          <span>{t("connectAppStore.description")}</span>{" "}
          <GuideLink href={CONNECT_GUIDES.appStore} subject="App Store Connect">
            {t("connectAppStore.guide")}
          </GuideLink>
        </>
      }
      error={error}
      pending={mutation.isPending}
      onSubmit={submit}
      trigger={
        <Button variant={variant} size="sm">
          {label}
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="asc-issuer-id">{t("connectAppStore.issuerId")}</Label>
        <Input
          id="asc-issuer-id"
          value={issuerId}
          onChange={(event) => setIssuerId(event.target.value)}
          placeholder="57246542-96fe-1a63-e053-0824d011072a"
          autoComplete="off"
          spellCheck={false}
          className="font-mono md:text-caption"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="asc-key-id">{t("connectAppStore.keyId")}</Label>
        <Input
          id="asc-key-id"
          value={keyId}
          onChange={(event) => setKeyId(event.target.value)}
          placeholder="2X9R4HXF34"
          autoComplete="off"
          spellCheck={false}
          className="font-mono md:text-caption"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="asc-private-key">
          {t("connectAppStore.privateKey")}
        </Label>
        <Input
          id="asc-private-key"
          type="password"
          value={privateKey}
          onChange={(event) => setPrivateKey(event.target.value)}
          placeholder={t("connectAppStore.privateKeyPlaceholder")}
          autoComplete="off"
          spellCheck={false}
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
        />
        <Label htmlFor="asc-private-key-file" className="sr-only">
          {t("connectAppStore.privateKeyFile")}
        </Label>
        <Input
          id="asc-private-key-file"
          type="file"
          accept=".p8,application/x-pem-file,text/plain"
          className="max-w-xs"
          onChange={(event) => void choose(event.target.files?.[0])}
        />
        <p className="text-caption text-muted-foreground">
          {t("connectAppStore.keyNote")}
        </p>
      </div>
    </AlertChannelDialog>
  );
}
