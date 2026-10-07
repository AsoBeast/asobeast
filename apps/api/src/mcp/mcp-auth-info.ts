import type { AuthInfo } from '@modelcontextprotocol/server';
import type { ApiTokenScope } from '@asobeast/shared';

export const MCP_AUTH_CLIENT_ID = 'asobeast-personal-token';

export function authInfoFor(scope: ApiTokenScope): AuthInfo {
  return { token: '', clientId: MCP_AUTH_CLIENT_ID, scopes: [scope] };
}

export function tokenScopeOf(authInfo: AuthInfo | undefined): ApiTokenScope {
  return authInfo?.scopes.includes('write') ? 'write' : 'read';
}
