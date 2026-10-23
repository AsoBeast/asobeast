"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { ApiError, connectStore, startPlaySignIn } from "@/lib/api";
import { invalidateStoreConnectionMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { AlertChannelDialog } from "./alert-channel/AlertChannelDialog";
import {
  isServiceAccountKey,
  PlayServiceAccountField,
} from "./PlayServiceAccountField";

const METHOD_ORDER = ["google", "key"] as const;
type Method = (typeof METHOD_ORDER)[number];

const BUCKET = /^pubsite_prod(_rev)?_\d+$/;
const SIGN_IN_LABEL = "Sign in with Google";

const METHODS: Record<Method, { label: string; description: string }> = {
  google: {
    label: SIGN_IN_LABEL,
    description:
      "Sign in with the Google account that owns your Play Console developer account. AsoBeast asks Google for read only access to Cloud Storage and for access to Play Console to post the review replies you send, checks the bucket and stores the sign in encrypted.",
  },
  key: {
    label: "Service account key",
    description:
      "Use a Google Cloud service account invited in Play Console under Users and permissions, with View app information and download bulk reports on the Account permissions tab. AsoBeast checks it with Google, stores the key encrypted and never shows it again.",
  },
};

const bucketOf = (raw: string): string =>
  raw
    .trim()
    .replace(/^gs:\/\//, "")
    .split("/")[0];

function problemOf(
  method: Method,
  bucket: string,
  serviceAccountJson: string,
): string | null {
  if (!BUCKET.test(bucket)) {
    return "Copy the bucket id that starts with pubsite_prod from Download reports in Play Console.";
  }
  if (method === "key" && !isServiceAccountKey(serviceAccountJson)) {
    return "Choose the JSON key file Google Cloud downloaded for the service account, or paste its contents.";
  }
  return null;
}

const messageOf = (failure: unknown): string =>
  failure instanceof ApiError
    ? failure.envelope.message
    : "Could not connect the Google Play Console.";

export function ConnectPlayDialog({
  label,
  googleSignIn,
}: {
  label: string;
  googleSignIn: boolean;
}) {
  const queryClient = useQueryClient();
  const initial: Method = googleSignIn ? "google" : "key";
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Method>(initial);
  const method: Method = googleSignIn ? chosen : "key";
  const [bucket, setBucket] = useState("");
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) setRedirecting(false);
    };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);

  function reset(next: boolean) {
    setOpen(next);
    if (next) return;
    setChosen(initial);
    setBucket("");
    setServiceAccountJson("");
    setError(null);
    setRedirecting(false);
  }

  const keyMutation = useMutation({
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
    onError: (failure) => setError(messageOf(failure)),
  });
  const signInMutation = useMutation({
    mutationFn: () => startPlaySignIn({ bucket: bucketOf(bucket) }),
    onSuccess: ({ url }) => {
      setRedirecting(true);
      window.location.assign(url);
    },
    onError: (failure) => setError(messageOf(failure)),
  });
  const pending =
    keyMutation.isPending || signInMutation.isPending || redirecting;
  const connectOnce = useSingleFlight(keyMutation);
  const signInOnce = useSingleFlight(signInMutation);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = problemOf(method, bucketOf(bucket), serviceAccountJson);
    setError(problem);
    if (problem) return;
    if (pending) return;
    if (method === "google") signInOnce();
    else connectOnce();
  }

  return (
    <AlertChannelDialog
      open={open}
      onOpenChange={reset}
      label={label}
      submitLabel={method === "google" ? SIGN_IN_LABEL : label}
      description={METHODS[method].description}
      error={error}
      pending={pending}
      onSubmit={submit}
      trigger={
        <Button variant="outline" size="sm">
          {label}
        </Button>
      }
    >
      {googleSignIn ? (
        <Tabs
          value={method}
          onValueChange={(next) => {
            const picked = METHOD_ORDER.find((each) => each === next);
            if (!picked || pending) return;
            setChosen(picked);
            setServiceAccountJson("");
            setError(null);
          }}
        >
          <TabsList aria-label="How to connect">
            {METHOD_ORDER.map((each) => (
              <TabsOption key={each} value={each}>
                {METHODS[each].label}
              </TabsOption>
            ))}
          </TabsList>
        </Tabs>
      ) : null}
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
      {method === "key" ? (
        <PlayServiceAccountField
          value={serviceAccountJson}
          onChange={setServiceAccountJson}
        />
      ) : null}
    </AlertChannelDialog>
  );
}
