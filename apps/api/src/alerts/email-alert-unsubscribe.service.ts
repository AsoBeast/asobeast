import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BACKEND_PROXY_PATH, UNSUBSCRIBE_PATH } from '@asobeast/shared';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from './mailer.service';
import { isUnsubscribeToken, unsubscribeToken } from './unsubscribe-token';

const NOT_FOUND = 'Email alert not found';

const UNSUBSCRIBE_JUSTIFICATION =
  'a one click unsubscribe arrives from a mailbox provider without a session, so no workspace is in scope';

export interface UnsubscribeLinks {
  page: string;
  oneClick: string;
}

export function oneClickHeaders(
  links: UnsubscribeLinks | null,
): Record<string, string> {
  if (!links?.oneClick.startsWith('https://')) return {};
  return {
    'List-Unsubscribe': `<${links.oneClick}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

@Injectable()
export class EmailAlertUnsubscribe {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly mailer: MailerService,
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
  ) {}

  links(alertId: string): UnsubscribeLinks | null {
    const origin = this.mailer.origin;
    if (!origin) return null;
    const token = unsubscribeToken(this.secret, alertId);
    const id = encodeURIComponent(alertId);
    return {
      page: `${origin}${UNSUBSCRIBE_PATH}?alert=${id}&token=${token}`,
      oneClick: `${origin}${BACKEND_PROXY_PATH}/email-alerts/${id}/unsubscribe?token=${token}`,
    };
  }

  async unsubscribe(alertId: string, token: string): Promise<void> {
    if (!isUnsubscribeToken(this.secret, alertId, token)) {
      throw new NotFoundException(NOT_FOUND);
    }
    const { count } =
      await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
        UNSUBSCRIBE_JUSTIFICATION,
        () =>
          this.prisma.emailAlert.updateMany({
            where: { id: alertId },
            data: { active: false },
          }),
      );
    if (count === 0) {
      throw new NotFoundException(NOT_FOUND);
    }
  }

  private get secret(): string {
    return this.config.get('AUTH_SECRET', { infer: true });
  }
}
