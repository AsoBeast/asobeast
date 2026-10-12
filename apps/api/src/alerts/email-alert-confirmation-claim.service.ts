import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import {
  isConfirmationExpired,
  isConfirmationToken,
} from './confirmation-token';

const NOT_FOUND = 'That confirmation link is not valid';

const EXPIRED = 'That confirmation link has expired';

const CONFIRM_JUSTIFICATION =
  'a recipient confirms an email alert from a mailbox, without a session, so no workspace is in scope';

@Injectable()
export class EmailAlertConfirmationClaim {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
  ) {}

  confirm(alertId: string, token: string): Promise<void> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      CONFIRM_JUSTIFICATION,
      () => this.claim(alertId, token),
    );
  }

  private async claim(alertId: string, token: string): Promise<void> {
    const alert = await this.prisma.emailAlert.findUnique({
      where: { id: alertId },
      select: { email: true, confirmedAt: true, confirmationSentAt: true },
    });
    const sentAt = alert?.confirmationSentAt;
    if (
      !alert ||
      !sentAt ||
      !isConfirmationToken(
        this.secret,
        { alertId, email: alert.email, sentAt },
        token,
      )
    ) {
      throw new NotFoundException(NOT_FOUND);
    }
    if (alert.confirmedAt) return;
    if (isConfirmationExpired(sentAt)) {
      throw new GoneException(EXPIRED);
    }
    const link = {
      id: alertId,
      email: alert.email,
      confirmationSentAt: sentAt,
    };
    const { count } = await this.prisma.emailAlert.updateMany({
      where: { ...link, confirmedAt: null },
      data: { confirmedAt: new Date() },
    });
    if (count > 0) return;
    const claimed = await this.prisma.emailAlert.findFirst({
      where: { ...link, confirmedAt: { not: null } },
      select: { id: true },
    });
    if (!claimed) {
      throw new NotFoundException(NOT_FOUND);
    }
  }

  private get secret(): string {
    return this.config.get('AUTH_SECRET', { infer: true });
  }
}
