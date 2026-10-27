import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TrialOffer } from '@asobeast/shared';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import type { AccountUser } from './auth.types';
import { TrialClaims } from './trial-claims';
import { canStartTrial } from './trial-grant';
import { trialOfferFor } from './trial-offer';

export const OFFER_JUSTIFICATION =
  'a trial offer is decided against the mailbox claims of every workspace';

@Injectable()
export class TrialOffers {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly claims: TrialClaims,
    private readonly config: ConfigService<Env, true>,
  ) {}

  offerFor(user: AccountUser, now = new Date()): Promise<TrialOffer | null> {
    if (!this.config.get('BILLING_ENABLED', { infer: true })) {
      return Promise.resolve(null);
    }
    if (user.role !== 'owner' || !canStartTrial(user.workspace, now)) {
      return Promise.resolve(null);
    }
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      OFFER_JUSTIFICATION,
      async () =>
        trialOfferFor(
          {
            workspace: user.workspace,
            mailboxClaimed: await this.claims.isClaimed(
              this.prisma,
              user.email,
            ),
            days: this.config.get('TRIAL_DAYS', { infer: true }),
          },
          now,
        ),
    );
  }
}
