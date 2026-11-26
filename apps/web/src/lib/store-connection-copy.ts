import { createTranslator } from "next-intl";
import enIntegrations from "../../messages/en/integrations.json";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import {
  INTEGRATIONS_PATH,
  type Store,
  type StoreConnectionApp,
  type StoreConnectionItem,
  type StoreReportState,
} from "@asobeast/shared";
import {
  formatDate,
  formatDateInLocale,
  formatDateTimeInLocale,
} from "./format";

export const STORE_CONNECTIONS_SECTION_ID = "store-connections";
export const STORE_CONNECTIONS_PATH = `${INTEGRATIONS_PATH}#${STORE_CONNECTIONS_SECTION_ID}`;
export const INTEGRATIONS_GUIDE =
  "https://docs.asobeast.com/integrations/overview";
export const STORE_CONNECT_SETTING_GUIDE =
  "https://docs.asobeast.com/configuration/reference#store-consoles";
export const CONNECT_GUIDES = {
  appStore:
    "https://docs.asobeast.com/integrations/app-store-connect#create-the-key",
  google:
    "https://docs.asobeast.com/integrations/google-play#sign-in-with-google",
  key: "https://docs.asobeast.com/integrations/google-play#use-a-service-account-key",
} as const;

export interface StatusLine {
  tone: "warning" | "muted";
  text: string;
}

export interface StoreConsoleCopy {
  name: string;
  guide: string;
  before: readonly [string, string, string];
  connectLabel: string;
  replaceLabel: string;
  empty: string;
  noApps: string;
  appsLabel: string;
  verified: string;
  refused: string;
  waiting: string;
  disconnect: string;
  states: Record<StoreReportState, string>;
  facts: (item: StoreConnectionItem) => [string, string][];
}

const english = createTranslator({
  locale: "en",
  namespace: "integrations",
  messages: { integrations: enIntegrations },
});

const connectedOn = (item: StoreConnectionItem): [string, string] => [
  "Connected",
  formatDate(item.createdAt),
];

export const STORE_CONSOLES: Record<Store, StoreConsoleCopy> = {
  APP_STORE: {
    name: "App Store Connect",
    guide: "https://docs.asobeast.com/integrations/app-store-connect",
    before: [
      "You need the Account Holder or Admin role in App Store Connect to create a team key.",
      "It takes about five minutes, and Apple lets you download the key file only once.",
      "The first numbers appear one or two days after you connect.",
    ],
    connectLabel: "Connect App Store Connect",
    replaceLabel: "Replace key",
    empty:
      "No store connected. Connect App Store Connect to see impressions, product page views, Get taps and conversion by market, and to post review replies from the reviews page.",
    noApps: "Import an App Store app to read its numbers through this key.",
    appsLabel: "Apps this key reports",
    verified: "Key checked with Apple",
    refused:
      "App Store Connect refused this key. Verify it again, or connect a new key.",
    waiting:
      "Waiting for Apple's first report, usually within two days of connecting.",
    disconnect:
      "AsoBeast deletes the stored key and stops downloading reports. The numbers already stored are kept and appear again once you connect a key. Revoke the key in App Store Connect too if you no longer need it.",
    states: {
      requested: "Reporting",
      unmatched: "Not in this team",
      forbidden: "Needs an Admin key",
      stopped: "Stopped by Apple, verify to request again",
    },
    facts: (item) => [
      ["Issuer ID", item.issuerId],
      ["Key ID", item.keyId],
      ["Fingerprint", item.keyFingerprint],
      connectedOn(item),
    ],
  },
  GOOGLE_PLAY: {
    name: "Google Play Console",
    guide: "https://docs.asobeast.com/integrations/google-play",
    before: [
      "You need Owner or Admin access to the Play Console developer account.",
      "Copy the bucket id from Download reports in Play Console first.",
      "It takes about ten minutes, and Google can take up to two days to apply a new service account's access.",
    ],
    connectLabel: "Connect Google Play",
    replaceLabel: "Reconnect",
    empty:
      "Not connected. Connect the Google Play Console to see store listing visitors, acquisitions and conversion by market and installs per search term, and to post review replies from the reviews page.",
    noApps:
      "Import a Google Play app to read its numbers through this connection.",
    appsLabel: "Apps this connection reports",
    verified: "Access checked with Google",
    refused:
      "Google refused this connection. Check its access in Play Console, verify it again, or reconnect.",
    waiting:
      "Waiting for the first store performance file, which Google writes to the bucket once a day.",
    disconnect:
      "AsoBeast deletes the stored service account key or Google sign in and stops reading the bucket. The numbers already stored are kept and appear again once you reconnect. Delete the key in Google Cloud, or remove AsoBeast under Third party connections in your Google account, if you no longer need it.",
    states: {
      requested: "Reporting",
      unmatched: "No files in this bucket",
      forbidden: "No access to this app",
      stopped: "Stopped, verify to read again",
    },
    facts: (item) =>
      item.credential === "googleAccount"
        ? [
            ["Google account", item.issuerId],
            ["Bucket", item.bucket ?? "—"],
            connectedOn(item),
          ]
        : [
            ["Service account", item.issuerId],
            ["Key ID", item.keyId],
            ["Bucket", item.bucket ?? "—"],
            ["Fingerprint", item.keyFingerprint],
            connectedOn(item),
          ],
  },
};

export function storeConsoleCopy(
  store: Store,
  t: MessageTranslator = english,
  locale: Locale = "en",
): StoreConsoleCopy {
  const base = STORE_CONSOLES[store];
  const namespace =
    store === "APP_STORE"
      ? "storeConnections.appStore"
      : "storeConnections.googlePlay";
  const connected = (item: StoreConnectionItem): [string, string] => [
    t("storeConnections.connected"),
    formatDateInLocale(item.createdAt, locale),
  ];
  return {
    ...base,
    before:
      store === "APP_STORE"
        ? [
            t("storeConnections.appStore.beforeRole"),
            t("storeConnections.appStore.beforeTime"),
            t("storeConnections.appStore.beforeNumbers"),
          ]
        : [
            t("storeConnections.googlePlay.beforeOwner"),
            t("storeConnections.googlePlay.beforeBucket"),
            t("storeConnections.googlePlay.beforeTime"),
          ],
    connectLabel: t(`${namespace}.connect`),
    replaceLabel: t(`${namespace}.replace`),
    empty: t(`${namespace}.empty`),
    noApps: t(`${namespace}.noApps`),
    appsLabel: t(`${namespace}.appsLabel`),
    verified: t(`${namespace}.verified`),
    refused: t(`${namespace}.refused`),
    waiting: t(`${namespace}.waiting`),
    disconnect: t(`${namespace}.disconnect`),
    states: {
      requested: t(`${namespace}.states.requested`),
      unmatched: t(`${namespace}.states.unmatched`),
      forbidden: t(`${namespace}.states.forbidden`),
      stopped: t(`${namespace}.states.stopped`),
    },
    facts: (item) =>
      store === "APP_STORE"
        ? [
            [t("storeConnections.facts.issuerId"), item.issuerId],
            [t("storeConnections.facts.keyId"), item.keyId],
            [t("storeConnections.facts.fingerprint"), item.keyFingerprint],
            connected(item),
          ]
        : item.credential === "googleAccount"
          ? [
              [t("storeConnections.facts.googleAccount"), item.issuerId],
              [t("storeConnections.facts.bucket"), item.bucket ?? "—"],
              connected(item),
            ]
          : [
              [t("storeConnections.facts.serviceAccount"), item.issuerId],
              [t("storeConnections.facts.keyId"), item.keyId],
              [t("storeConnections.facts.bucket"), item.bucket ?? "—"],
              [t("storeConnections.facts.fingerprint"), item.keyFingerprint],
              connected(item),
            ],
  };
}

export function connectionStatusLine(
  item: StoreConnectionItem,
  t: MessageTranslator = english,
  locale: Locale = "en",
): StatusLine {
  const copy = storeConsoleCopy(item.store, t, locale);
  if (item.status === "rejected") {
    return { tone: "warning", text: item.lastError ?? copy.refused };
  }
  if (item.lastError) return { tone: "warning", text: item.lastError };
  if (!item.lastSyncedAt || item.apps.every((app) => app.lastDate === null)) {
    return { tone: "muted", text: copy.waiting };
  }
  return {
    tone: "muted",
    text: t("storeConnections.lastSynced", {
      date: formatDateTimeInLocale(item.lastSyncedAt, locale),
    }),
  };
}

export function replyAccessLine(
  item: StoreConnectionItem,
  t: MessageTranslator = english,
): StatusLine {
  if (item.replyAccess === "forbidden") {
    return {
      tone: "warning",
      text:
        item.credential === "googleAccount"
          ? t("storeConnections.googleSignInCannotReply")
          : item.store === "APP_STORE"
            ? t("storeConnections.replyRoleAppStore")
            : t("storeConnections.replyRoleGoogle"),
    };
  }
  return {
    tone: "muted",
    text:
      item.replyAccess === "allowed"
        ? t("storeConnections.allowed")
        : t("storeConnections.notTried"),
  };
}

export const needsAdminKey = (item: StoreConnectionItem): boolean =>
  item.store === "APP_STORE" &&
  item.status !== "rejected" &&
  item.apps.some((app) => app.state === "forbidden");

export function appStateLabel(
  state: StoreReportState | null,
  store: Store = "APP_STORE",
  t: MessageTranslator = english,
): string {
  return state
    ? storeConsoleCopy(store, t).states[state]
    : t("storeConnections.waiting");
}

export function historyLine(
  app: StoreConnectionApp,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  if (!app.firstDate || !app.lastDate) return t("storeConnections.noData");
  return t("storeConnections.dataFrom", {
    from: formatDateInLocale(app.firstDate, locale),
    to: formatDateInLocale(app.lastDate, locale),
  });
}
