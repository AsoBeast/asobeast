import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ESSENTIAL_ALERT_EVENTS } from '@asobeast/shared';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { essentialAlertsNeed } from './default-alerts-readiness';
import { EmailAlertsService } from './email-alerts.service';
import { MailerService } from './mailer.service';

export const ESSENTIAL_RANK_DROP_THRESHOLD = 10;

export const DEFAULT_ALERTS_OUTCOMES = [
  'created',
  'unconfirmed',
  'skipped',
  'settled',
  'not_due',
  'waiting',
] as const;
export type DefaultAlertsOutcome = (typeof DEFAULT_ALERTS_OUTCOMES)[number];

const OWNER_ROLE = 'owner';

@Injectable()
export class DefaultAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService<Env, true>,
    private readonly emailAlerts: EmailAlertsService,
  ) {}

  get mailWorks(): boolean {
    return (
      essentialAlertsNeed(this.mailer.enabled, this.mailer.origin) === null
    );
  }

  async createFor(date: string): Promise<DefaultAlertsOutcome> {
    if (!this.mailWorks) return 'skipped';
    if (await this.isSettled()) return 'settled';
    if (!(await this.isDue(date))) return 'not_due';
    const owner = await this.prisma.user.findFirst({
      where: { role: OWNER_ROLE },
      orderBy: { createdAt: 'asc' },
      select: { email: true, emailVerifiedAt: true },
    });
    if (!owner || (this.requiresVerifiedOwner && !owner.emailVerifiedAt)) {
      return 'waiting';
    }
    const created = await this.emailAlerts.createDefault(owner.email, {
      events: [...ESSENTIAL_ALERT_EVENTS],
      rankDropThreshold: ESSENTIAL_RANK_DROP_THRESHOLD,
      confirmDrops: true,
    });
    if (!created) return 'settled';
    return created.confirmed === false ? 'unconfirmed' : 'created';
  }

  async pending(): Promise<boolean> {
    return !(await this.isSettled());
  }

  private get requiresVerifiedOwner(): boolean {
    return this.config.get('BILLING_ENABLED', { infer: true });
  }

  private async isSettled(): Promise<boolean> {
    const workspace = await this.prisma.workspace.findFirst({
      select: { defaultAlertsAt: true },
    });
    return workspace?.defaultAlertsAt != null;
  }

  private async isDue(date: string): Promise<boolean> {
    const ranked = await this.prisma.keywordRanking.findFirst({
      where: {
        date: new Date(`${date}T00:00:00.000Z`),
        app: { isCompetitor: false },
      },
      select: { appId: true },
    });
    return ranked !== null;
  }
}
