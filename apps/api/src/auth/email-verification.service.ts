import { randomBytes } from 'node:crypto';
import {
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User, Workspace } from '@prisma/client';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { sha256 } from './password-hash';
import { refuseSessionSwap } from './session-swap';
import type { AccountUser } from './auth.types';
import { alreadyTrialed, grantTrial, type TrialGrant } from './trial-grant';
import { VerificationMailer } from './verification-mailer';

const VERIFICATION_HOURS = 24;

const CLAIM_JUSTIFICATION =
  'a confirmation link is claimed before the account has a workspace in scope';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly verification: VerificationMailer,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get billing(): boolean {
    return this.config.get('BILLING_ENABLED', { infer: true });
  }

  get required(): boolean {
    return this.billing && this.verification.configured;
  }

  openingGrant(): TrialGrant | undefined {
    if (!this.billing || this.required) return undefined;
    return grantTrial(this.config.get('TRIAL_DAYS', { infer: true }));
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
    const user = await this.prisma.user.findUnique({
      where: { verificationHash: sha256(token) },
      include: { workspace: true },
    });
    if (!user || !user.verificationExpiresAt) {
      throw new NotFoundException('That verification link is no longer valid');
    }
    if (user.verificationExpiresAt <= new Date()) {
      throw new GoneException('That verification link has expired');
    }
    refuseSessionSwap(signedIn, user);

    const emailVerifiedAt = new Date();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt,
        verificationHash: null,
        verificationExpiresAt: null,
      },
    });
    return {
      ...user,
      emailVerifiedAt,
      verificationHash: null,
      verificationExpiresAt: null,
      workspace: await this.startTrial(user.workspaceId),
    };
  }

  private async startTrial(workspaceId: string): Promise<Workspace> {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
    if (!this.billing || alreadyTrialed(workspace)) return workspace;

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: grantTrial(this.config.get('TRIAL_DAYS', { infer: true })),
    });
  }
}
