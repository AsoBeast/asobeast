import { randomBytes } from 'node:crypto';
import {
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma, User } from '@prisma/client';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { isDisposableEmail } from './disposable-email';
import { sha256 } from './password-hash';
import { refuseSessionSwap } from './session-swap';
import type { AccountUser } from './auth.types';
import {
  declineTrial,
  trialAwaitsConfirmation,
  trialStillOpen,
  type TrialDecline,
} from './trial-grant';
import { TrialClaims, type TrialClaimStore } from './trial-claims';
import { VERIFICATION_HOURS, VerificationMailer } from './verification-mailer';

const SPENT_LINK = 'That verification link is no longer valid';

const CLAIM_JUSTIFICATION =
  'a confirmation link is claimed before the account has a workspace in scope';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly verification: VerificationMailer,
    private readonly claims: TrialClaims,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get billing(): boolean {
    return this.config.get('BILLING_ENABLED', { infer: true });
  }

  get required(): boolean {
    return this.billing && this.verification.configured;
  }

  async openingTerms(
    db: TrialClaimStore,
    email: string,
  ): Promise<TrialDecline | undefined> {
    if (!this.billing) return undefined;
    return this.refusalOf(email, () => this.claims.isClaimed(db, email));
  }

  private async refusalOf(
    email: string,
    mailboxTaken: () => Promise<boolean>,
  ): Promise<TrialDecline | undefined> {
    if (isDisposableEmail(email)) {
      return this.decline(`an address on a disposable email domain: ${email}`);
    }
    if (await mailboxTaken()) {
      return this.decline(`an address whose mailbox already had one: ${email}`);
    }
    return undefined;
  }

  private decline(reason: string): TrialDecline {
    this.logger.warn(`no trial for ${reason}`);
    return declineTrial();
  }

  async writeTerms(
    db: Prisma.TransactionClient,
    workspace: { id: string; plan: string },
    terms: TrialDecline,
  ): Promise<void> {
    await db.workspace.updateMany({
      where: trialStillOpen(workspace),
      data: terms,
    });
  }

  awaitsConfirmation(user: AccountUser, now = new Date()): boolean {
    return this.required && trialAwaitsConfirmation(user, now);
  }

  async invite(user: AccountUser): Promise<void> {
    if (!this.required) return;

    try {
      await this.issue(user);
    } catch (error) {
      this.logger.error(
        `could not send the confirmation email to ${user.email}, so the account must ask for a new link: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async resend(user: AccountUser): Promise<void> {
    if (!this.required || user.emailVerifiedAt) return;
    await this.issue(user);
  }

  private async issue(user: AccountUser): Promise<void> {
    const token = randomBytes(24).toString('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationHash: sha256(token),
        verificationExpiresAt: new Date(
          Date.now() + VERIFICATION_HOURS * 60 * 60 * 1000,
        ),
      },
    });
    await this.verification.send(user.email, token);
  }

  claim(token: string, signedIn: User | null): Promise<AccountUser> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      CLAIM_JUSTIFICATION,
      () => this.confirm(token, signedIn),
    );
  }

  private async confirm(
    token: string,
    signedIn: User | null,
  ): Promise<AccountUser> {
    const verificationHash = sha256(token);
    const user = await this.prisma.user.findUnique({
      where: { verificationHash },
      include: { workspace: true },
    });
    if (!user || !user.verificationExpiresAt) {
      throw new NotFoundException(SPENT_LINK);
    }
    if (user.verificationExpiresAt <= new Date()) {
      throw new GoneException('That verification link has expired');
    }
    refuseSessionSwap(signedIn, user);

    const emailVerifiedAt = new Date();
    const { count } = await this.prisma.user.updateMany({
      where: { id: user.id, verificationHash },
      data: {
        emailVerifiedAt,
        verificationHash: null,
        verificationExpiresAt: null,
      },
    });
    if (count === 0) throw new NotFoundException(SPENT_LINK);
    return {
      ...user,
      emailVerifiedAt,
      verificationHash: null,
      verificationExpiresAt: null,
      workspace: await this.prisma.workspace.findUniqueOrThrow({
        where: { id: user.workspaceId },
      }),
    };
  }
}
