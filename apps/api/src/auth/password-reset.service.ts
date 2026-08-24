import { randomBytes } from 'node:crypto';
import {
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { PrismaService } from '../prisma/prisma.service';
import { sha256 } from './password-hash';
import { RecoveryRateLimiter } from './rate-limit/recovery-rate.limiter';
import { RecoveryMailer } from './recovery-mailer';

export const RESET_TOKEN_MINUTES = 60;

const LINK_NOT_VALID = 'That recovery link is no longer valid';

const LINK_EXPIRED = 'That recovery link has expired';

export const RECOVERY_UNAVAILABLE =
  'Account recovery needs an email transport and a public web address, and this instance is missing one of them';

const REQUEST_JUSTIFICATION =
  'a recovery link is requested before the account has a workspace in scope';

const REDEEM_JUSTIFICATION =
  'a recovery link is redeemed before the account has a workspace in scope';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly recovery: RecoveryMailer,
    private readonly limiter: RecoveryRateLimiter,
  ) {}

  get available(): boolean {
    return this.recovery.configured;
  }

  async request(email: string, now = new Date()): Promise<void> {
    if (!this.available) {
      throw new ServiceUnavailableException(RECOVERY_UNAVAILABLE);
    }
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      REQUEST_JUSTIFICATION,
      () => this.issue(normalizeEmail(email), now),
    );
  }

  redeem(token: string, password: string, now = new Date()): Promise<void> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      REDEEM_JUSTIFICATION,
      () => this.spend(token, password, now),
    );
  }

  private async issue(email: string, now: Date): Promise<void> {
    if (!(await this.limiter.claim(email, now))) return;

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });
    if (!user) return;

    const token = randomBytes(24).toString('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetHash: sha256(token),
        resetExpiresAt: new Date(now.getTime() + RESET_TOKEN_MINUTES * 60_000),
      },
    });

    this.dispatch(user.email, token);
  }

  private dispatch(email: string, token: string): void {
    void this.recovery.send(email, token).catch((error: unknown) => {
      this.logger.error(
        `could not send the recovery email to ${email}, so the account must ask for a new link: ${reason(error)}`,
      );
    });
  }

  private async spend(
    token: string,
    password: string,
    now: Date,
  ): Promise<void> {
    const resetHash = sha256(token);
    const user = await this.prisma.user.findUnique({
      where: { resetHash },
      select: { id: true, resetExpiresAt: true },
    });
    if (!user?.resetExpiresAt) {
      throw new NotFoundException(LINK_NOT_VALID);
    }
    if (user.resetExpiresAt <= now) {
      throw new GoneException(LINK_EXPIRED);
    }

    const passwordHash = await argon2.hash(password);
    const { count } = await this.prisma.user.updateMany({
      where: { resetHash, resetExpiresAt: { gt: now } },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
        resetHash: null,
        resetExpiresAt: null,
      },
    });
    if (count !== 1) {
      throw new NotFoundException(LINK_NOT_VALID);
    }
    this.logger.log(
      `account ${user.id} recovered its password from an emailed link, ending every session it had open`,
    );
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
