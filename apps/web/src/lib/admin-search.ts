import type {
  AdminApp,
  AdminUser,
  SupportWorkspaceSummary,
} from "@asobeast/shared";
import { matchesSearch } from "./search-text";

export const userMatches = (user: AdminUser, query: string) =>
  matchesSearch(
    [user.email, user.name ?? "", user.workspaceName, user.workspaceId],
    query,
  );

export const workspaceMatches = (
  workspace: SupportWorkspaceSummary,
  query: string,
) => matchesSearch([workspace.name, workspace.workspaceId], query);

export const appMatches = (app: AdminApp, query: string) =>
  matchesSearch(
    [app.name ?? "", app.storeAppId, app.workspaceName, app.workspaceId],
    query,
  );
