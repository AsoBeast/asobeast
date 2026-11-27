import {
  isPostEdited,
  type ReviewReplyItem,
  type ReviewReplyPost,
  type Store,
  type StoreConnectionState,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enReviews from "../../../messages/en/reviews.json";
import enIntegrations from "../../../messages/en/integrations.json";
import type { MessageTranslator } from "@/i18n/translator";
import { storeLabel } from "@/lib/format";
import { replyAccessLine, STORE_CONSOLES } from "@/lib/store-connection-copy";
import { consoleLabel } from "./store-console";

const english = createTranslator({
  locale: "en",
  namespace: "reviews",
  messages: { reviews: enReviews },
});

const englishIntegrations = createTranslator({
  locale: "en",
  namespace: "integrations",
  messages: { integrations: enIntegrations },
});

export type StoreReplyAccessKind =
  "off" | "none" | "rejected" | "forbidden" | "ready";

export interface StoreReplyAccess {
  kind: StoreReplyAccessKind;
  note: string | null;
}

const OFF: StoreReplyAccess = { kind: "off", note: null };

export const PLAY_NO_WITHDRAW =
  "Google Play offers no way to remove a reply through its API. Edit it here and post again, or remove it in Play Console.";

export function storeReplyAccess(
  state: StoreConnectionState | undefined,
  store: Store,
  t: MessageTranslator = english,
  connectionT: MessageTranslator = englishIntegrations,
): StoreReplyAccess {
  if (!state?.available) return OFF;
  const name = STORE_CONSOLES[store].name;
  const item = state.connections.find((each) => each.store === store);
  if (!item) {
    return {
      kind: "none",
      note: t("storeAccess.connect", { name }),
    };
  }
  if (item.status === "rejected") {
    return {
      kind: "rejected",
      note: item.lastError
        ? t("storeAccess.rejectedError", { error: item.lastError })
        : t("storeAccess.rejected", { name }),
    };
  }
  if (item.replyAccess === "forbidden") {
    return { kind: "forbidden", note: replyAccessLine(item, connectionT).text };
  }
  return {
    kind: "ready",
    note: t("storeAccess.ready", { console: consoleLabel(store) }),
  };
}

export const postLabel = (
  store: Store,
  t: MessageTranslator = english,
): string =>
  t(
    store === "APP_STORE" ? "storeAccess.postAppStore" : "storeAccess.postPlay",
  );

export function postActionLabel(
  store: Store,
  reply: Pick<ReviewReplyItem, "text" | "post"> | null | undefined,
  t: MessageTranslator = english,
): string {
  return reply?.post ? t("storeAccess.updateAppStore") : postLabel(store, t);
}

export function postRules(
  store: Store,
  t: MessageTranslator = english,
): string[] {
  return [
    t("storeAccess.publicRule", { store: storeLabel(store) }),
    t("storeAccess.oneReply"),
    t("storeAccess.noRatingAsk"),
    ...(store === "APP_STORE" ? [t("storeAccess.apple24")] : []),
  ];
}

export function postedToast(
  store: Store,
  post: ReviewReplyPost,
  t: MessageTranslator = english,
): string {
  if (store === "GOOGLE_PLAY") return t("storeAccess.postedPlay");
  return post.state === "pending"
    ? t("storeAccess.postedPending")
    : t("storeAccess.postedAppStore");
}

export const WITHDRAWN_TOAST =
  "Withdrawn from App Store Connect. Apple removes it within a day.";

export function discardNotice(
  store: Store,
  reply: Pick<ReviewReplyItem, "post"> | null | undefined,
  t: MessageTranslator = english,
): string {
  if (!reply?.post) {
    return t("storeAccess.discardConsole", { console: consoleLabel(store) });
  }
  return store === "APP_STORE"
    ? t("storeAccess.appStoreStays")
    : t("storeAccess.playStays");
}

export const needsPosting = (
  reply: Pick<ReviewReplyItem, "text" | "post"> | null | undefined,
  text: string,
): boolean => !reply?.post || isPostEdited({ text, post: reply.post });

export function markLabel(
  marked: boolean,
  ready: boolean,
  t: MessageTranslator = english,
): string {
  if (marked) return t("storeAccess.undo");
  return ready ? t("storeAccess.markWithoutPosting") : t("storeAccess.mark");
}

export interface ComposerActions {
  post: string | null;
  withdraw: boolean;
  discard: boolean;
  mark: boolean;
}

export function composerActions(
  access: StoreReplyAccess,
  store: Store,
  reply: Pick<ReviewReplyItem, "text" | "post"> | null | undefined,
  text: string,
  t: MessageTranslator = english,
): ComposerActions {
  const ready = access.kind === "ready";
  const posted = Boolean(reply?.post);
  const withdraw = ready && posted && store === "APP_STORE";
  return {
    post:
      ready && needsPosting(reply, text)
        ? postActionLabel(store, reply, t)
        : null,
    withdraw,
    discard: !withdraw,
    mark: !posted,
  };
}
