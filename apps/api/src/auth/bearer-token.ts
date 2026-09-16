const BEARER_CREDENTIALS = /^bearer +([A-Za-z0-9._~+/-]+=*)$/i;

export function bearerToken(authorization: string | undefined): string | null {
  return BEARER_CREDENTIALS.exec(authorization?.trim() ?? '')?.[1] ?? null;
}
