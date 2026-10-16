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

const BUCKET = /^pubsite_prod(_rev)?_\d+$/;

const bucketOf = (raw: string): string =>
  raw
    .trim()
    .replace(/^gs:\/\//, "")
    .split("/")[0];
const KEY_FIELDS = ["client_email", "private_key_id", "private_key"] as const;

function isServiceAccountKey(text: string): boolean {
  try {
    const parsed: unknown = JSON.parse(text);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      KEY_FIELDS.every(
        (field) =>
          typeof (parsed as Record<string, unknown>)[field] === "string",
      )
    );
  } catch {
    return false;
  }
}

function problemOf(bucket: string, serviceAccountJson: string): string | null {
  if (!BUCKET.test(bucket)) {
    return "Copy the bucket id that starts with pubsite_prod from Download reports in Play Console.";
  }
  if (!isServiceAccountKey(serviceAccountJson)) {
    return "Choose the JSON key file Google Cloud downloaded for the service account, or paste its contents.";
  }
  return null;
}

export function ConnectPlayDialog({ label }: { label: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bucket, setBucket] = useState("");
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset(next: boolean) {
    setOpen(next);
    if (next) return;
    setBucket("");
    setServiceAccountJson("");
    setError(null);
  }

  const mutation = useMutation({
    mutationFn: () =>
      connectStore({
        store: "GOOGLE_PLAY",
        bucket: bucketOf(bucket),
        serviceAccountJson,
      }),
    onSuccess: () => {
      invalidateStoreConnectionMutation(queryClient);
      toast.success("Google Play Console connected");
      reset(false);
    },
    onError: (failure) =>
      setError(
        failure instanceof ApiError
          ? failure.envelope.message
          : "Could not connect the Google Play Console.",
      ),
  });
  const connectOnce = useSingleFlight(mutation);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = problemOf(bucketOf(bucket), serviceAccountJson);
    setError(problem);
    if (!problem) connectOnce();
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    setServiceAccountJson(await file.text());
  }

  return (
    <AlertChannelDialog
      open={open}
      onOpenChange={reset}
      label={label}
      description="Use a Google Cloud service account invited in Play Console under Users and permissions with View app information and download bulk reports. AsoBeast checks it with Google, stores the key encrypted and never shows it again."
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
        <Label htmlFor="play-bucket">Bucket id</Label>
        <Input
          id="play-bucket"
          value={bucket}
          onChange={(event) => setBucket(event.target.value)}
          placeholder="pubsite_prod_rev_01234567890987654321"
          autoComplete="off"
          spellCheck={false}
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Play Console shows it under Download reports, as the Cloud Storage URI
          after gs://.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="play-service-account">Service account key</Label>
        <Input
          id="play-service-account"
          type="password"
          value={serviceAccountJson}
          onChange={(event) => setServiceAccountJson(event.target.value)}
          placeholder="Contents of the downloaded JSON key"
          autoComplete="off"
          spellCheck={false}
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
        />
        <Label htmlFor="play-service-account-file" className="sr-only">
          Service account key file
        </Label>
        <Input
          id="play-service-account-file"
          type="file"
          accept="application/json,.json"
          className="max-w-xs"
          onChange={(event) => void choose(event.target.files?.[0])}
        />
        <p className="text-xs text-muted-foreground">
          Choose the JSON key file or paste its contents. AsoBeast only reads
          the store performance files in the bucket.
        </p>
      </div>
    </AlertChannelDialog>
  );
}
