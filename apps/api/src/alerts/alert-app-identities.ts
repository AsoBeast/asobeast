import { Injectable } from '@nestjs/common';
import type { AlertAppIdentity, AlertPayload } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';

export type IdentityLookup = ReadonlyMap<string, Required<AlertAppIdentity>>;

export function appIdsOf(payload: AlertPayload): string[] {
  return 'app' in payload ? [payload.app.id] : [];
}

export function withAppIdentity<T extends AlertPayload>(
  payload: T,
  lookup: IdentityLookup,
): T {
  if (!('app' in payload)) return payload;
  const identity = lookup.get(payload.app.id);
  if (!identity) return payload;
  return { ...payload, app: { ...payload.app, ...identity } };
}

@Injectable()
export class AlertAppIdentities {
  constructor(private readonly prisma: PrismaService) {}

  async lookup(appIds: readonly string[]): Promise<IdentityLookup> {
    if (appIds.length === 0) return new Map();
    const rows = await this.prisma.app.findMany({
      where: { id: { in: [...appIds] } },
      select: { id: true, iconUrl: true, store: true, country: true },
    });
    return new Map(rows.map(({ id, ...identity }) => [id, identity] as const));
  }

  async attach(payload: AlertPayload): Promise<AlertPayload> {
    return withAppIdentity(payload, await this.lookup(appIdsOf(payload)));
  }
}
