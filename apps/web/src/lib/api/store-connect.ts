import type {
  Store,
  StoreConnectionItem,
  StoreConnectionRequest,
  StoreConnectionState,
  StoreConnectionSyncResult,
} from "@asobeast/shared";
import { apiFetch } from "./client";

const pathOf = (store: Store): string => `/store-connections/${store}`;

export function getStoreConnections(): Promise<StoreConnectionState> {
  return apiFetch<StoreConnectionState>("/store-connections");
}

export function connectStore(
  body: StoreConnectionRequest,
): Promise<StoreConnectionItem> {
  return apiFetch<StoreConnectionItem>(pathOf(body.store), {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function verifyStore(store: Store): Promise<StoreConnectionItem> {
  return apiFetch<StoreConnectionItem>(`${pathOf(store)}/verify`, {
    method: "POST",
  });
}

export function syncStore(store: Store): Promise<StoreConnectionSyncResult> {
  return apiFetch<StoreConnectionSyncResult>(`${pathOf(store)}/sync`, {
    method: "POST",
  });
}

export function disconnectStore(store: Store): Promise<void> {
  return apiFetch<void>(pathOf(store), { method: "DELETE" });
}
