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
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  closeUnlessPending,
  ConfirmActionFooter,
} from "@/components/ConfirmActionFooter";
import { Button } from "@/components/ui/button";
import { FactList } from "@/components/settings/FactList";
import { PanelBody, SettingsPanel } from "@/components/settings/SettingsPanel";
import { StateWord } from "@/components/settings/StateWord";
import { ApiError, disconnectStore, syncStore, verifyStore } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { armFocusHandoff, useFocusGroupClaim } from "@/lib/focus-handoff";
import {
  invalidateStoreConnectionMutation,
  storeConnectionsOptions,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import {
  connectionStatusLine,
  STORE_CONNECT_SETTING_GUIDE,
  STORE_CONNECTIONS_SECTION_ID,
  STORE_CONSOLES,
  type StoreConsoleCopy,
  needsAdminKey,
  replyAccessLine,
} from "@/lib/store-connection-copy";
import { ConnectAppStoreDialog } from "./ConnectAppStoreDialog";
import { connectionMark } from "./connection-summary";
import { ConnectPlayDialog } from "./ConnectPlayDialog";
import { GuideLink } from "./GuideLink";
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

const connectFocusKey = (store: Store) => `store-connect:${store}`;

const failureOf = (error: unknown, fallback: string): string =>
  error instanceof ApiError ? error.envelope.message : fallback;

function useConnectionAction<T>(
  action: () => Promise<T>,
  success: string,
  failure: string,
  onDone?: () => void,
) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: action,
    onSuccess: () => {
      onDone?.();
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
    () => armFocusHandoff(connectFocusKey(store)),
  );

  return (
    <AlertDialog
      open={open}
      onOpenChange={closeUnlessPending(disconnect.pending, setOpen)}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          Disconnect
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect {copy.name}?</AlertDialogTitle>
          <AlertDialogDescription>{copy.disconnect}</AlertDialogDescription>
        </AlertDialogHeader>
        <ConfirmActionFooter
          pending={disconnect.pending}
          label="Disconnect"
          pendingLabel="Disconnecting…"
          onConfirm={disconnect.run}
        />
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
        aria-disabled={verify.pending || undefined}
        onClick={() => verify.run()}
      >
        Verify
      </Button>
      {rejected ? null : (
        <Button
          variant="outline"
          size="sm"
          aria-disabled={sync.pending || undefined}
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

const CONNECTED_TERM = "Connected";

function ConnectionDetails({
  item,
  actions,
}: {
  item: StoreConnectionItem;
  actions: ReactNode;
}) {
  const status = connectionStatusLine(item);
  const replies = replyAccessLine(item);
  const warned = status.tone === "warning";

  return (
    <>
      <PanelBody className="gap-4">
        <FactList
          facts={[
            ...STORE_CONSOLES[item.store].facts(item).map(([term, value]) => ({
              term,
              value,
              identifier: term !== CONNECTED_TERM,
            })),
            {
              term: "Review replies",
              value: (
                <span
                  className={
                    replies.tone === "warning"
                      ? "text-warning"
                      : "text-muted-foreground"
                  }
                >
                  {replies.text}
                </span>
              ),
            },
          ]}
        />
        <p
          role="status"
          className={
            warned
              ? "max-w-[70ch] text-body text-warning"
              : "text-caption text-muted-foreground"
          }
        >
          {status.text}
        </p>
        {actions}
      </PanelBody>
      <StoreConnectionApps
        store={item.store}
        apps={item.apps}
        lastSyncedAt={item.lastSyncedAt}
      />
    </>
  );
}

function ConnectionFooter({
  item,
  guide,
}: {
  item: StoreConnectionItem;
  guide: ReactNode;
}) {
  return (
    <>
      {item.verifiedAt ? (
        <p className="min-w-0 flex-1 basis-64">
          {`Verified ${formatDate(item.verifiedAt)}`}
        </p>
      ) : null}
      <span className="ml-auto">{guide}</span>
    </>
  );
}

function BeforeYouStart({
  store,
  copy,
}: {
  store: Store;
  copy: StoreConsoleCopy;
}) {
  const labelId = `before-you-start-${store}`;

  return (
    <div className="flex flex-col gap-2">
      <p id={labelId} className="text-label text-foreground">
        <span>Before you start</span>
        <span className="sr-only">{` with ${copy.name}`}</span>
      </p>
      <ul
        aria-labelledby={labelId}
        className="flex max-w-[70ch] list-disc flex-col gap-1 pl-4 text-body text-muted-foreground"
      >
        {copy.before.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
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
  const header = useFocusGroupClaim(
    connectFocusKey(store),
    Boolean(connection),
  );

  const mark = connection ? connectionMark(connection) : null;
  const guide = (
    <GuideLink href={copy.guide} subject={copy.name}>
      Setup guide
    </GuideLink>
  );

  return (
    <SettingsPanel
      title={copy.name}
      headerRef={header}
      action={
        mark ? (
          <StateWord tone={mark.tone}>{mark.word}</StateWord>
        ) : owner ? (
          <ConnectDialog store={store} label={copy.connectLabel} />
        ) : null
      }
      footer={
        connection ? (
          <ConnectionFooter item={connection} guide={guide} />
        ) : (
          <span className="ml-auto">{guide}</span>
        )
      }
    >
      {connection ? (
        <ConnectionDetails
          item={connection}
          actions={owner ? <ConnectionActions item={connection} /> : null}
        />
      ) : (
        <PanelBody className="gap-4">
          <p className="max-w-[70ch] text-body text-muted-foreground">
            {copy.empty}
          </p>
          {owner ? <BeforeYouStart store={store} copy={copy} /> : null}
        </PanelBody>
      )}
    </SettingsPanel>
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
      <SettingsPanel
        title="Store connections are off"
        footer={
          <span className="ml-auto">
            <GuideLink
              href={STORE_CONNECT_SETTING_GUIDE}
              subject="store connections"
            >
              How to turn them on
            </GuideLink>
          </span>
        }
      >
        <PanelBody>
          <p className="max-w-[70ch] text-body text-muted-foreground">
            {STORE_CONNECT_OFF}
          </p>
        </PanelBody>
      </SettingsPanel>
    );
  }

  return (
    <div className="flex flex-col gap-3">
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
