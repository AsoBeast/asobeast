"use client";

import { useState } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { StoreConnectionItem } from "@asobeast/shared";
import { useAuth } from "@/components/auth/use-auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiError, disconnectStore, syncStore, verifyStore } from "@/lib/api";
import { formatDate } from "@/lib/format";
import {
  invalidateStoreConnectionMutation,
  storeConnectionsOptions,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { connectionStatusLine } from "@/lib/store-connection-copy";
import { cn } from "@/lib/utils";
import { ConnectAppStoreDialog } from "./ConnectAppStoreDialog";
import { StoreConnectionApps } from "./StoreConnectionApps";

const OWNER_ONLY = "Only the workspace owner can connect a store.";

const failureOf = (error: unknown, fallback: string): string =>
  error instanceof ApiError ? error.envelope.message : fallback;

function useConnectionAction<T>(
  action: () => Promise<T>,
  success: string,
  failure: string,
) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: action,
    onSuccess: () => {
      invalidateStoreConnectionMutation(queryClient);
      toast.success(success);
    },
    onError: (error) => toast.error(failureOf(error, failure)),
  });
  return { pending: mutation.isPending, run: useSingleFlight(mutation) };
}

function DisconnectButton() {
  const [open, setOpen] = useState(false);
  const disconnect = useConnectionAction(
    () => disconnectStore("APP_STORE"),
    "App Store Connect disconnected",
    "Could not disconnect App Store Connect",
  );

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Disconnect
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect App Store Connect?</AlertDialogTitle>
          <AlertDialogDescription>
            AsoBeast deletes the stored key and stops downloading reports. The
            numbers already stored are kept and appear again once you connect a
            key. Revoke the key in App Store Connect too if you no longer need
            it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disconnect.pending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={disconnect.pending}
            onClick={(event) => {
              event.preventDefault();
              disconnect.run();
            }}
          >
            {disconnect.pending ? "Disconnecting…" : "Disconnect"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConnectionActions({ item }: { item: StoreConnectionItem }) {
  const verify = useConnectionAction(
    () => verifyStore(item.store),
    "Key checked with Apple",
    "Could not verify the key",
  );
  const sync = useConnectionAction(
    () => syncStore(item.store),
    "Sync queued",
    "Could not queue a sync",
  );
  const rejected = item.status === "rejected";

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={rejected ? "default" : "outline"}
        size="sm"
        disabled={verify.pending}
        onClick={() => verify.run()}
      >
        Verify
      </Button>
      {rejected ? null : (
        <Button
          variant="outline"
          size="sm"
          disabled={sync.pending}
          onClick={() => sync.run()}
        >
          Sync now
        </Button>
      )}
      <ConnectAppStoreDialog label="Replace key" />
      <DisconnectButton />
    </div>
  );
}

function ConnectionDetails({ item }: { item: StoreConnectionItem }) {
  const status = connectionStatusLine(item);
  const facts = [
    ["Issuer ID", item.issuerId],
    ["Key ID", item.keyId],
    ["Fingerprint", item.keyFingerprint],
    ["Connected", formatDate(item.createdAt)],
  ];

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        {facts.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd translate="no" className="min-w-0 font-mono text-xs break-all">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p
        role="status"
        className={cn(
          "text-body",
          status.tone === "warning" ? "text-warning" : "text-muted-foreground",
        )}
      >
        {status.text}
      </p>
      <StoreConnectionApps apps={item.apps} />
    </div>
  );
}

export function StoreConnectionsCard() {
  const { user, isOwner } = useAuth();
  const { data } = useSuspenseQuery(storeConnectionsOptions);
  const connection = data.connections.find(
    (item) => item.store === "APP_STORE",
  );
  const owner = Boolean(user) && isOwner;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardDescription>Store console</CardDescription>
          <CardTitle>App Store Connect</CardTitle>
        </div>
        {owner && data.available && !connection ? (
          <ConnectAppStoreDialog label="Connect App Store Connect" />
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!data.available ? (
          <p className="text-body text-muted-foreground">
            Store connections are off on this instance. Set
            STORE_CONNECT_ENCRYPTION_KEY to turn them on.
          </p>
        ) : connection ? (
          <ConnectionDetails item={connection} />
        ) : (
          <p className="text-body text-muted-foreground">
            No store connected. Connect App Store Connect to see impressions,
            product page views, Get taps and conversion by market.
          </p>
        )}
        {data.available && user && !isOwner ? (
          <p className="text-body text-muted-foreground">{OWNER_ONLY}</p>
        ) : null}
        {owner && connection ? <ConnectionActions item={connection} /> : null}
      </CardContent>
    </Card>
  );
}
