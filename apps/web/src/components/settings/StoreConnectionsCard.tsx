"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  SUPPORTED_STORES,
  type Store,
  type StoreConnectionItem,
} from "@asobeast/shared";
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
import {
  invalidateStoreConnectionMutation,
  storeConnectionsOptions,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import {
  connectionStatusLine,
  STORE_CONNECTIONS_SECTION_ID,
  STORE_CONSOLES,
  needsAdminKey,
  replyNote,
} from "@/lib/store-connection-copy";
import { cn } from "@/lib/utils";
import { ConnectAppStoreDialog } from "./ConnectAppStoreDialog";
import { ConnectPlayDialog } from "./ConnectPlayDialog";
import { StoreConnectionApps } from "./StoreConnectionApps";

const OWNER_ONLY = "Only the workspace owner can connect a store.";
const STORE_CONNECT_OFF =
  "Store connections are off on this instance. Set STORE_CONNECT_ENCRYPTION_KEY to turn them on.";

function ConnectDialog({
  store,
  label,
  variant,
}: {
  store: Store;
  label: string;
  variant?: "default" | "outline";
}) {
  const { data } = useSuspenseQuery(storeConnectionsOptions);
  return store === "APP_STORE" ? (
    <ConnectAppStoreDialog label={label} variant={variant} />
  ) : (
    <ConnectPlayDialog
      label={label}
      googleSignIn={data.googleSignIn === true}
    />
  );
}

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

function DisconnectButton({ store }: { store: Store }) {
  const [open, setOpen] = useState(false);
  const copy = STORE_CONSOLES[store];
  const disconnect = useConnectionAction(
    () => disconnectStore(store),
    `${copy.name} disconnected`,
    `Could not disconnect ${copy.name}`,
  );

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Disconnect
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect {copy.name}?</AlertDialogTitle>
          <AlertDialogDescription>{copy.disconnect}</AlertDialogDescription>
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
  const copy = STORE_CONSOLES[item.store];
  const verify = useConnectionAction(
    () => verifyStore(item.store),
    copy.verified,
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
      <ConnectDialog
        store={item.store}
        label={copy.replaceLabel}
        variant={needsAdminKey(item) ? "default" : "outline"}
      />
      <DisconnectButton store={item.store} />
    </div>
  );
}

function ConnectionDetails({
  item,
  actions,
}: {
  item: StoreConnectionItem;
  actions: ReactNode;
}) {
  const status = connectionStatusLine(item);
  const facts = STORE_CONSOLES[item.store].facts(item);
  const note = replyNote(item);

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
      {note ? <p className="text-body text-muted-foreground">{note}</p> : null}
      {actions}
      <StoreConnectionApps store={item.store} apps={item.apps} />
    </div>
  );
}

function StoreConsoleCard({
  store,
  connection,
}: {
  store: Store;
  connection: StoreConnectionItem | undefined;
}) {
  const { user, isOwner } = useAuth();
  const copy = STORE_CONSOLES[store];
  const owner = Boolean(user) && isOwner;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardDescription>Store console</CardDescription>
          <CardTitle>{copy.name}</CardTitle>
        </div>
        {owner && !connection ? (
          <ConnectDialog store={store} label={copy.connectLabel} />
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {connection ? (
          <ConnectionDetails
            item={connection}
            actions={owner ? <ConnectionActions item={connection} /> : null}
          />
        ) : (
          <p className="text-body text-muted-foreground">{copy.empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

function useScrollIntoViewOnHash() {
  useEffect(() => {
    if (window.location.hash !== `#${STORE_CONNECTIONS_SECTION_ID}`) return;
    document
      .getElementById(STORE_CONNECTIONS_SECTION_ID)
      ?.scrollIntoView({ block: "start" });
  }, []);
}

export function StoreConnectionsCard() {
  const { user, isOwner } = useAuth();
  const { data } = useSuspenseQuery(storeConnectionsOptions);
  useScrollIntoViewOnHash();

  if (!data.available) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>Store console</CardDescription>
          <CardTitle>Store connections</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-body text-muted-foreground">{STORE_CONNECT_OFF}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {SUPPORTED_STORES.map((store) => (
        <StoreConsoleCard
          key={store}
          store={store}
          connection={data.connections.find((item) => item.store === store)}
        />
      ))}
      {user && !isOwner ? (
        <p className="text-body text-muted-foreground">{OWNER_ONLY}</p>
      ) : null}
    </div>
  );
}
