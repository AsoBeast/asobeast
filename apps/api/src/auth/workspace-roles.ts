import { WORKSPACE_ROLES, type WorkspaceRole } from '@asobeast/shared';

export const OWNER_ROLE: WorkspaceRole = 'owner';

export const MEMBER_ROLE: WorkspaceRole = 'member';

export function workspaceRoleOf(role: string): WorkspaceRole {
  return WORKSPACE_ROLES.includes(role as WorkspaceRole)
    ? (role as WorkspaceRole)
    : MEMBER_ROLE;
}
