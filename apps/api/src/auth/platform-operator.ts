import { NotFoundException } from '@nestjs/common';
import { DEFAULT_WORKSPACE_ID } from '../common/tenancy/default-workspace';
import { OWNER_ROLE } from './workspace-roles';

export interface PlatformPrincipal {
  role: string;
  workspaceId: string;
}

export function isPlatformOperator(user: PlatformPrincipal): boolean {
  return user.role === OWNER_ROLE && user.workspaceId === DEFAULT_WORKSPACE_ID;
}

export function requirePlatformOperator(
  user: PlatformPrincipal,
  notFound: string,
): void {
  if (!isPlatformOperator(user)) {
    throw new NotFoundException(notFound);
  }
}
