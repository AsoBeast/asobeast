import type { AiStatus } from "@asobeast/shared";
import { apiFetch } from "./client";

export function getAiStatus(): Promise<AiStatus> {
  return apiFetch<AiStatus>("/ai/status");
}
