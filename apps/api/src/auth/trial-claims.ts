import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { mailboxOf } from './mailbox-key';

const PURPOSE = 'trial-claim';

export interface TrialClaimStore {
  trialClaim: {
    findUnique(args: { where: { key: string } }): Promise<unknown>;
    createMany(args: {
      data: { key: string }[];
      skipDuplicates: true;
    }): Promise<{ count: number }>;
  };
}

@Injectable()
export class TrialClaims {
  constructor(private readonly config: ConfigService<Env, true>) {}

  keyOf(email: string): string {
    return createHmac('sha256', this.config.get('AUTH_SECRET', { infer: true }))
      .update(`${PURPOSE}:${mailboxOf(email)}`)
      .digest('base64url');
  }

  async isClaimed(db: TrialClaimStore, email: string): Promise<boolean> {
    const claim = await db.trialClaim.findUnique({
      where: { key: this.keyOf(email) },
    });
    return claim !== null;
  }

  async claim(db: TrialClaimStore, email: string): Promise<boolean> {
    return (await this.claimAll(db, [email])) === 1;
  }

  async claimAll(db: TrialClaimStore, emails: string[]): Promise<number> {
    const { count } = await db.trialClaim.createMany({
      data: emails.map((email) => ({ key: this.keyOf(email) })),
      skipDuplicates: true,
    });
    return count;
  }
}
