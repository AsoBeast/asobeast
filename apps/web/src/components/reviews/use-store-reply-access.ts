"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { Store } from "@asobeast/shared";
import { storeConnectionsOptions } from "@/lib/queries";
import { type StoreReplyAccess, storeReplyAccess } from "./store-reply-access";

export function useStoreReplyAccess(store: Store): StoreReplyAccess {
  const t = useTranslations("reviews");
  const connectionT = useTranslations("integrations");
  const { data } = useQuery(storeConnectionsOptions);
  return storeReplyAccess(data, store, t, connectionT);
}
