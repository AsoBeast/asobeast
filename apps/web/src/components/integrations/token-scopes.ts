import type { ApiTokenScope } from "@asobeast/shared";

export const SCOPE_LABELS: Record<ApiTokenScope, string> = {
  read: "Read only",
  write: "Read and write",
};
