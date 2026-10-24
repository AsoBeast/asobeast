import { Injectable, Logger } from '@nestjs/common';
import type { AlertAppIdentity, AlertPayload } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';

export type ResolvedAppIdentity = Required<AlertAppIdentity>;

export function withAppIdentity<T extends AlertPayload>(
  payload: T,
  identity: ResolvedAppIdentity | null,
): T {
  if (!identity || !('app' in payload)) return payload;
  return { ...payload, app: { ...payload.app, ...identity } };
}

@Injectable()
export class AlertAppIdentities {
  private readonly logger = new Logger(AlertAppIdentities.name);

  constructor(private readonly prisma: PrismaService) {}

  async attach<T extends AlertPayload>(payload: T): Promise<T> {
    if (!('app' in payload)) return payload;
    try {
      const identity = await this.prisma.app.findUnique({
        where: { id: payload.app.id },
        select: { iconUrl: true, store: true, country: true },
      });
      return withAppIdentity(payload, identity);
    } catch (error) {
      this.logger.warn(
        `alert app identity unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
      return payload;
    }
  }
}
