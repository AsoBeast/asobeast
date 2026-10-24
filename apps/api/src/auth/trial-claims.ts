import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { mailboxOf } from './mailbox-key';

const PURPOSE = 'trial-claim';

const CARD_PURPOSE = `${PURPOSE}:card`;

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
    return this.digest(`${PURPOSE}:${mailboxOf(email)}`);
  }

  cardKeyOf(fingerprint: string): string {
    return this.digest(`${CARD_PURPOSE}:${fingerprint}`);
  }

  private digest(material: string): string {
    return createHmac('sha256', this.config.get('AUTH_SECRET', { infer: true }))
      .update(material)
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

  async claimCard(db: TrialClaimStore, fingerprint: string): Promise<boolean> {
    return (await this.insert(db, [this.cardKeyOf(fingerprint)])) === 1;
  }

  claimAll(db: TrialClaimStore, emails: string[]): Promise<number> {
    return this.insert(
      db,
      emails.map((email) => this.keyOf(email)),
    );
  }

  private async insert(db: TrialClaimStore, keys: string[]): Promise<number> {
    const { count } = await db.trialClaim.createMany({
      data: keys.map((key) => ({ key })),
      skipDuplicates: true,
    });
    return count;
  }
}
