"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, connectStore } from "@/lib/api";
import { invalidateStoreConnectionMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { AlertChannelDialog } from "./alert-channel/AlertChannelDialog";

const ISSUER_ID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const KEY_ID = /^[A-Za-z0-9]{10}$/;
const PRIVATE_KEY_MARKER = "BEGIN PRIVATE KEY";

function problemOf(
  issuerId: string,
  keyId: string,
  privateKey: string,
): string | null {
  if (!ISSUER_ID.test(issuerId)) {
    return "Paste the issuer ID shown above the team keys in App Store Connect.";
  }
  if (!KEY_ID.test(keyId)) return "The key ID is ten letters and digits.";
  if (!privateKey.includes(PRIVATE_KEY_MARKER)) {
    return "Paste the whole contents of the .p8 file, or choose the file.";
  }
  return null;
}

export function ConnectAppStoreDialog({ label }: { label: string }) {
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
      toast.success("App Store Connect connected");
      reset(false);
    },
    onError: (failure) =>
      setError(
        failure instanceof ApiError
          ? failure.envelope.message
          : "Could not connect App Store Connect.",
      ),
  });
  const connectOnce = useSingleFlight(mutation);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = problemOf(issuerId.trim(), keyId.trim(), privateKey);
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
      description="Use a team key from Users and Access, Integrations. AsoBeast checks it with Apple, stores it encrypted and never shows it again."
      error={error}
      pending={mutation.isPending}
      onSubmit={submit}
      trigger={
        <Button variant="outline" size="sm">
          {label}
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="asc-issuer-id">Issuer ID</Label>
        <Input
          id="asc-issuer-id"
          value={issuerId}
          onChange={(event) => setIssuerId(event.target.value)}
          placeholder="57246542-96fe-1a63-e053-0824d011072a"
          autoComplete="off"
          spellCheck={false}
          className="font-mono text-xs"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="asc-key-id">Key ID</Label>
        <Input
          id="asc-key-id"
          value={keyId}
          onChange={(event) => setKeyId(event.target.value)}
          placeholder="2X9R4HXF34"
          autoComplete="off"
          spellCheck={false}
          className="font-mono text-xs"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="asc-private-key">Private key</Label>
        <Input
          id="asc-private-key"
          type="password"
          value={privateKey}
          onChange={(event) => setPrivateKey(event.target.value)}
          placeholder="Contents of AuthKey_2X9R4HXF34.p8"
          autoComplete="off"
          spellCheck={false}
        />
        <Label htmlFor="asc-private-key-file" className="sr-only">
          Private key file
        </Label>
        <Input
          id="asc-private-key-file"
          type="file"
          accept=".p8,application/x-pem-file,text/plain"
          className="max-w-xs"
          onChange={(event) => void choose(event.target.files?.[0])}
        />
        <p className="text-xs text-muted-foreground">
          Paste the key or choose the .p8 file you downloaded. Use an Admin key
          the first time, so AsoBeast can ask Apple for the reports. A Sales and
          Reports key can take over afterwards.
        </p>
      </div>
    </AlertChannelDialog>
  );
}
