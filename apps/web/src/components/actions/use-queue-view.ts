"use client";

import { useQueryStates, type SetValues, type Values } from "nuqs";
import { actionQueueParsers } from "@/lib/search-params";

export type QueueViewState = Values<typeof actionQueueParsers>;
export type SetQueueView = SetValues<typeof actionQueueParsers>;

export function useQueueView(): [QueueViewState, SetQueueView] {
  return useQueryStates(actionQueueParsers);
}
