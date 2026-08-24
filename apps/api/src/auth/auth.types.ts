import type { ApiTokenScope } from '@asobeast/shared';
import type { User, Workspace } from '@prisma/client';

export interface SessionClaims {
  sub: string;
  sv: number;
}

export type AccountUser = User & { workspace: Workspace };

export type AuthCredential = 'session' | 'token';

export interface ResolvedToken {
  user: AccountUser;
  scope: ApiTokenScope;
}

export type AuthenticatedRequest = {
  user?: AccountUser;
  credential?: AuthCredential;
  tokenScope?: ApiTokenScope;
};
