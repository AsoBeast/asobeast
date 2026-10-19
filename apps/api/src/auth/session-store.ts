import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SESSION_ID_BYTES = 24;

@Injectable()
export class SessionStore {
  constructor(private readonly prisma: PrismaService) {}

  async open(
    tx: Prisma.TransactionClient,
    userId: string,
    expiresAt: Date,
  ): Promise<string> {
    const id = randomBytes(SESSION_ID_BYTES).toString('base64url');
    await tx.session.create({ data: { id, userId, expiresAt } });
    return id;
  }

  find(id: string, now = new Date()) {
    return this.prisma.session.findFirst({
      where: { id, expiresAt: { gt: now } },
      include: { user: { include: { workspace: true } } },
    });
  }

  async end(id: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id } });
  }
}

export function endSessions(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<Prisma.BatchPayload> {
  return tx.session.deleteMany({ where: { userId } });
}
