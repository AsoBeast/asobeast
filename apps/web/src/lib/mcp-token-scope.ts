import { DEFAULT_API_TOKEN_SCOPE, type ApiTokenScope } from "@asobeast/shared";

export const MCP_CHANGES_HINT =
  "Adds tools that track and untrack keywords, add and remove competitors, and change the status of actions. A token that can make changes can change anything through the API too, so keep it private.";

export function mcpTokenScope(allowChanges: boolean): ApiTokenScope {
  return allowChanges ? "write" : DEFAULT_API_TOKEN_SCOPE;
}

export function mcpTokenNotice(scope: ApiTokenScope): string {
  return scope === "write"
    ? "The token can make changes and is shown once. Copy what you need before closing, and keep it private."
    : "The token is read-only and is shown once. Copy what you need before closing.";
}
