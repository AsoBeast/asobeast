"use client";

import { useQuery } from "@tanstack/react-query";
import type { Store } from "@asobeast/shared";
import { storeConnectionsOptions } from "@/lib/queries";
import { type StoreReplyAccess, storeReplyAccess } from "./store-reply-access";

export function useStoreReplyAccess(store: Store): StoreReplyAccess {
  const { data } = useQuery(storeConnectionsOptions);
  return storeReplyAccess(data, store);
}
