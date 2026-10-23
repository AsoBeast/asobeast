import {
  isPostEdited,
  type ReviewReplyItem,
  type ReviewReplyPost,
  type Store,
  type StoreConnectionState,
} from "@asobeast/shared";
import { storeLabel } from "@/lib/format";
import { replyAccessLine, STORE_CONSOLES } from "@/lib/store-connection-copy";
import { consoleLabel } from "./store-console";

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
): StoreReplyAccess {
  if (!state?.available) return OFF;
  const name = STORE_CONSOLES[store].name;
  const item = state.connections.find((each) => each.store === store);
  if (!item) {
    return {
      kind: "none",
      note: `Connect ${name} in Settings to post replies from here.`,
    };
  }
  if (item.status === "rejected") {
    return {
      kind: "rejected",
      note: `${name} refused the connected key. Verify it or connect a new one in Settings to post replies.`,
    };
  }
  if (item.replyAccess === "forbidden") {
    return { kind: "forbidden", note: replyAccessLine(item).text };
  }
  return {
    kind: "ready",
    note: `Posting sends this text to ${consoleLabel(store)} with the key connected in Settings.`,
  };
}

export const postLabel = (store: Store): string =>
  `Post to ${storeLabel(store)}`;

export function postActionLabel(
  store: Store,
  reply: Pick<ReviewReplyItem, "text" | "post"> | null | undefined,
): string {
  return reply?.post ? `Update on ${storeLabel(store)}` : postLabel(store);
}

export function postRules(store: Store): string[] {
  return [
    `The reply is public under the review on ${storeLabel(store)}.`,
    "A review has one reply, so posting again replaces it.",
    "Do not ask for a rating or offer anything in return.",
    ...(store === "APP_STORE" ? ["Apple shows it within 24 hours."] : []),
  ];
}

export function postedToast(store: Store, post: ReviewReplyPost): string {
  if (store === "GOOGLE_PLAY") return "Posted on Google Play.";
  return post.state === "pending"
    ? "Posted to App Store Connect. Apple publishes it within 24 hours."
    : "Posted to App Store Connect.";
}

export const WITHDRAWN_TOAST =
  "Withdrawn from App Store Connect. Apple removes it within a day.";

export function discardNotice(
  store: Store,
  reply: Pick<ReviewReplyItem, "post"> | null | undefined,
): string {
  if (!reply?.post) {
    return `A reply already posted in ${consoleLabel(store)} stays there.`;
  }
  return store === "APP_STORE"
    ? "The reply posted to App Store Connect stays there unless you withdraw it."
    : "The reply posted on Google Play stays there.";
}

export const needsPosting = (
  reply: Pick<ReviewReplyItem, "text" | "post"> | null | undefined,
  text: string,
): boolean => !reply?.post || isPostEdited({ text, post: reply.post });

export function markLabel(marked: boolean, ready: boolean): string {
  if (marked) return "Undo";
  return ready ? "Mark as replied without posting" : "Mark as replied";
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
): ComposerActions {
  const ready = access.kind === "ready";
  const posted = Boolean(reply?.post);
  const withdraw = ready && posted && store === "APP_STORE";
  return {
    post:
      ready && needsPosting(reply, text) ? postActionLabel(store, reply) : null,
    withdraw,
    discard: !withdraw,
    mark: !posted,
  };
}
