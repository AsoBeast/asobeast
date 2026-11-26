"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReviewItem, Store } from "@asobeast/shared";
import { storeLabel } from "@/lib/format";
import { STORE_CONNECTIONS_PATH } from "@/lib/store-connection-copy";
import { cn } from "@/lib/utils";
import { consoleLabel } from "./store-console";
import type { StoreReplyAccess } from "./store-reply-access";

export function ReplyFooter({
  access,
  store,
  posted,
}: {
  access: StoreReplyAccess;
  store: Store;
  posted: boolean;
}) {
  const t = useTranslations("reviews");
  if (access.kind === "off") {
    return (
      <p className="text-caption text-muted-foreground">
        {t("storeAccess.off", { console: consoleLabel(store) })}
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
              className="font-medium text-foreground link-underline"
            >
              {t("storeAccess.openConnections")}
            </Link>
          </>
        )}
      </p>
      {access.kind === "ready" && posted && store === "GOOGLE_PLAY" ? (
        <p className="text-muted-foreground">
          {t("storeAccess.playCannotRemove")}
        </p>
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
  const t = useTranslations("reviews");
  if (!review.replyText || review.reply?.post) return null;
  return (
    <p className="text-caption text-muted-foreground">
      {t("storeAccess.alreadyShows", { store: storeLabel(store) })}
    </p>
  );
}
