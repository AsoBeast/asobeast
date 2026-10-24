import Link from "next/link";
import type { ReviewItem, Store } from "@asobeast/shared";
import { storeLabel } from "@/lib/format";
import { STORE_CONNECTIONS_PATH } from "@/lib/store-connection-copy";
import { cn } from "@/lib/utils";
import { consoleLabel } from "./store-console";
import { PLAY_NO_WITHDRAW, type StoreReplyAccess } from "./store-reply-access";

export function ReplyFooter({
  access,
  store,
  posted,
}: {
  access: StoreReplyAccess;
  store: Store;
  posted: boolean;
}) {
  if (access.kind === "off") {
    return (
      <p className="text-caption text-muted-foreground">
        AsoBeast never writes to the store. Paste the reply in{" "}
        {consoleLabel(store)}.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1 text-caption">
      <p
        className={cn(
          access.kind === "forbidden" || access.kind === "rejected"
            ? "text-warning"
            : "text-muted-foreground",
        )}
      >
        {access.note}
        {access.kind === "ready" ? null : (
          <>
            {" "}
            <Link
              href={STORE_CONNECTIONS_PATH}
              className="font-medium text-foreground underline decoration-primary underline-offset-4 hover:decoration-2"
            >
              Open store connections
            </Link>
          </>
        )}
      </p>
      {access.kind === "ready" && posted && store === "GOOGLE_PLAY" ? (
        <p className="text-muted-foreground">{PLAY_NO_WITHDRAW}</p>
      ) : null}
    </div>
  );
}

export function StoreReplyNotice({
  review,
  store,
}: {
  review: ReviewItem;
  store: Store;
}) {
  if (!review.replyText || review.reply?.post) return null;
  return (
    <p className="text-caption text-muted-foreground">
      {storeLabel(store)} already shows a reply. A new text here replaces it
      once posted.
    </p>
  );
}
