import { NotFoundException } from '@nestjs/common';
import { DEFAULT_WORKSPACE_ID } from '../common/tenancy/default-workspace';
import { OWNER_ROLE } from './workspace-roles';

export interface PlatformPrincipal {
  role: string;
  workspaceId: string;
}

export function isOperatorWorkspace(workspaceId: string): boolean {
  return workspaceId === DEFAULT_WORKSPACE_ID;
}

export function isPlatformOperator(user: PlatformPrincipal): boolean {
  return user.role === OWNER_ROLE && isOperatorWorkspace(user.workspaceId);
}

export function requirePlatformOperator(
  user: PlatformPrincipal,
  notFound: string,
): void {
  if (!isPlatformOperator(user)) {
    throw new NotFoundException(notFound);
  }
}
