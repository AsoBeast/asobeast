import {
  SUPPORTED_STORES,
  type StoreConnectionItem,
  type StoreConnectionState,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enIntegrations from "../../../messages/en/integrations.json";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import type { StateTone } from "@/components/settings/StateWord";
import { formatDateInLocale } from "@/lib/format";
import { needsAdminKey, storeConsoleCopy } from "@/lib/store-connection-copy";

export interface ConnectionMark {
  tone: StateTone;
  word: string;
}

const waiting = (item: StoreConnectionItem) =>
  !item.lastSyncedAt || item.apps.every((app) => app.lastDate === null);

const english = createTranslator({
  locale: "en",
  namespace: "integrations",
  messages: { integrations: enIntegrations },
});

export function connectionMark(
  item: StoreConnectionItem,
  t: MessageTranslator = english,
): ConnectionMark {
  if (item.status === "rejected") {
    return {
      tone: "warning",
      word: t(
        item.store === "APP_STORE"
          ? "storeConnections.summary.keyRefused"
          : "storeConnections.summary.connectionRefused",
      ),
    };
  }
  if (needsAdminKey(item)) {
    return { tone: "warning", word: t("storeConnections.summary.needsAdmin") };
  }
  if (item.lastError) {
    return {
      tone: "warning",
      word: t("storeConnections.summary.needsAttention"),
    };
  }
  if (waiting(item)) {
    return { tone: "off", word: t("storeConnections.summary.waitingData") };
  }
  return { tone: "on", word: t("storeConnections.summary.connected") };
}

export interface SummaryPart {
  figure?: string;
  text: string;
  after?: boolean;
  warning?: boolean;
}

export const NOTHING_CONNECTED =
  "No store connected yet. Connect one to see the store funnel beside your rankings.";

export function connectionSummary(
  state: StoreConnectionState,
  t: MessageTranslator = english,
  locale: Locale = "en",
): SummaryPart[] | null {
  if (!state.available) return null;
  const { connections } = state;
  if (connections.length === 0) {
    return [{ text: t("storeConnections.summary.nothingConnected") }];
  }

  const apps = connections.flatMap((item) => item.apps);
  const reporting = connections
    .filter((item) => item.status !== "rejected")
    .flatMap((item) => item.apps)
    .filter((app) => app.state === "requested").length;
  const newest = apps
    .flatMap((app) => (app.lastDate ? [app.lastDate] : []))
    .toSorted()
    .at(-1);
  const troubled = connections.filter(
    (item) => connectionMark(item, t).tone === "warning",
  );

  return [
    {
      figure: `${connections.length} of ${SUPPORTED_STORES.length}`,
      text: t("storeConnections.summary.storesConnected"),
    },
    ...troubled.map((item) => ({
      text: `${storeConsoleCopy(item.store, t, locale).name}: ${connectionMark(item, t).word.toLowerCase()}`,
      warning: true,
    })),
    ...(apps.length > 0
      ? [
          {
            figure: `${reporting} of ${apps.length}`,
            text: t("storeConnections.summary.appsReporting"),
          },
        ]
      : []),
    ...(newest
      ? [
          {
            text: t("storeConnections.summary.storeDataThrough"),
            figure: formatDateInLocale(newest, locale),
            after: true,
          },
        ]
      : []),
  ];
}
