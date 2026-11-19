import type { WorkspaceAction } from "@/lib/admin-support";

export const focusKeyOf = (action: WorkspaceAction) =>
  `support-action:${action}`;

export const WORKSPACE_GONE_FOCUS_KEY = "support-action:gone";
