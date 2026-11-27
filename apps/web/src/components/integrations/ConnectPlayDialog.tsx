"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { ApiError, connectStore, startPlaySignIn } from "@/lib/api";
import { invalidateStoreConnectionMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { CONNECT_GUIDES } from "@/lib/store-connection-copy";
import { AlertChannelDialog } from "@/components/settings/alert-channel/AlertChannelDialog";
import { GuideLink } from "./GuideLink";
import {
  isServiceAccountKey,
  PlayServiceAccountField,
} from "./PlayServiceAccountField";

const METHOD_ORDER = ["google", "key"] as const;
type Method = (typeof METHOD_ORDER)[number];

const BUCKET = /^pubsite_prod(_rev)?_\d+$/;

const METHOD_GUIDE = {
  google: CONNECT_GUIDES.google,
  key: CONNECT_GUIDES.key,
} as const;

const methodLabel = (
  method: Method,
  t: ReturnType<typeof useTranslations>,
): string =>
  t(method === "google" ? "connectPlay.googleLabel" : "connectPlay.keyLabel");

const methodDescription = (
  method: Method,
  t: ReturnType<typeof useTranslations>,
): string =>
  t(
    method === "google"
      ? "connectPlay.googleDescription"
      : "connectPlay.keyDescription",
  );

const bucketOf = (raw: string): string =>
  raw
    .trim()
    .replace(/^gs:\/\//, "")
    .split("/")[0];

function problemOf(
  method: Method,
  bucket: string,
  serviceAccountJson: string,
  t: ReturnType<typeof useTranslations>,
): string | null {
  if (!BUCKET.test(bucket)) {
    return t("connectPlay.bucketRequired");
  }
  if (method === "key" && !isServiceAccountKey(serviceAccountJson)) {
    return t("connectPlay.keyRequired");
  }
  return null;
}

const messageOf = (
  failure: unknown,
  t: ReturnType<typeof useTranslations>,
): string =>
  failure instanceof ApiError
    ? failure.envelope.message
    : t("connectPlay.connectFailed");

export function ConnectPlayDialog({
  label,
  googleSignIn,
}: {
  label: string;
  googleSignIn: boolean;
}) {
  const t = useTranslations("integrations");
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
      toast.success(t("connectPlay.connected"));
      reset(false);
    },
    onError: (failure) => setError(messageOf(failure, t)),
  });
  const signInMutation = useMutation({
    mutationFn: () => startPlaySignIn({ bucket: bucketOf(bucket) }),
    onSuccess: ({ url }) => {
      setRedirecting(true);
      window.location.assign(url);
    },
    onError: (failure) => setError(messageOf(failure, t)),
  });
  const pending =
    keyMutation.isPending || signInMutation.isPending || redirecting;
  const connectOnce = useSingleFlight(keyMutation);
  const signInOnce = useSingleFlight(signInMutation);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = problemOf(method, bucketOf(bucket), serviceAccountJson, t);
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
      submitLabel={method === "google" ? t("connectPlay.googleLabel") : label}
      description={
        <>
          <span>{methodDescription(method, t)}</span>{" "}
          <GuideLink href={METHOD_GUIDE[method]} subject="Google Play">
            {t("connectPlay.guide")}
          </GuideLink>
        </>
      }
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
          <TabsList aria-label={t("connectPlay.howConnect")}>
            {METHOD_ORDER.map((each) => (
              <TabsOption key={each} value={each}>
                {methodLabel(each, t)}
              </TabsOption>
            ))}
          </TabsList>
        </Tabs>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="play-bucket">{t("connectPlay.bucketId")}</Label>
        <Input
          id="play-bucket"
          value={bucket}
          onChange={(event) => setBucket(event.target.value)}
          placeholder="pubsite_prod_rev_01234567890987654321"
          autoComplete="off"
          spellCheck={false}
          className="font-mono md:text-caption"
        />
        <p className="text-caption text-muted-foreground">
          {t("connectPlay.bucketNote")}
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
