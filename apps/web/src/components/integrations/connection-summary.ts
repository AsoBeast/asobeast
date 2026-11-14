import {
  SUPPORTED_STORES,
  type StoreConnectionItem,
  type StoreConnectionState,
} from "@asobeast/shared";
import type { StateTone } from "@/components/settings/StateWord";
import { formatDate } from "@/lib/format";
import { needsAdminKey, STORE_CONSOLES } from "@/lib/store-connection-copy";

export interface ConnectionMark {
  tone: StateTone;
  word: string;
}

const waiting = (item: StoreConnectionItem) =>
  !item.lastSyncedAt || item.apps.every((app) => app.lastDate === null);

export function connectionMark(item: StoreConnectionItem): ConnectionMark {
  if (item.status === "rejected") {
    return {
      tone: "warning",
      word: item.store === "APP_STORE" ? "Key refused" : "Connection refused",
    };
  }
  if (needsAdminKey(item)) {
    return { tone: "warning", word: "Needs an Admin key" };
  }
  if (item.lastError) return { tone: "warning", word: "Needs attention" };
  if (waiting(item)) return { tone: "off", word: "Waiting for data" };
  return { tone: "on", word: "Connected" };
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
): SummaryPart[] | null {
  if (!state.available) return null;
  const { connections } = state;
  if (connections.length === 0) return [{ text: NOTHING_CONNECTED }];

  const apps = connections.flatMap((item) => item.apps);
  const reporting = apps.filter((app) => app.state === "requested").length;
  const newest = apps
    .flatMap((app) => (app.lastDate ? [app.lastDate] : []))
    .toSorted()
    .at(-1);
  const troubled = connections.filter(
    (item) => connectionMark(item).tone === "warning",
  );

  return [
    {
      figure: `${connections.length} of ${SUPPORTED_STORES.length}`,
      text: "stores connected",
    },
    ...troubled.map((item) => ({
      text: `${STORE_CONSOLES[item.store].name}: ${connectionMark(item).word.toLowerCase()}`,
      warning: true,
    })),
    ...(apps.length > 0
      ? [{ figure: `${reporting} of ${apps.length}`, text: "apps reporting" }]
      : []),
    ...(newest
      ? [
          {
            text: "store data through",
            figure: formatDate(newest),
            after: true,
          },
        ]
      : []),
  ];
}
