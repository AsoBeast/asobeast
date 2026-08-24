import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AlertBatchPayload,
  EmailAlertItem,
  RANK_DEPTH,
  WebhookTestResult,
} from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailAlertDto } from './dto/create-email-alert.dto';
import { UpdateEmailAlertDto } from './dto/update-email-alert.dto';
import { toEmailAlertItem } from './email-alerts.mapper';
import { formatEmail } from './email-format';
import { MailerService } from './mailer.service';

const DISABLED_MESSAGE = 'Email alerts require SMTP configuration';

@Injectable()
export class EmailAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly workspace: WorkspaceContext,
  ) {}

  async list(): Promise<EmailAlertItem[]> {
    const alerts = await this.prisma.emailAlert.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return alerts.map(toEmailAlertItem);
  }

  async create(dto: CreateEmailAlertDto): Promise<EmailAlertItem> {
    this.assertEnabled();
    const alert = await this.prisma.emailAlert.create({
      data: {
        workspaceId: this.workspace.require('an email alert'),
        email: dto.email,
        events: dto.events,
      },
    });
    return toEmailAlertItem(alert);
  }

  async update(id: string, dto: UpdateEmailAlertDto): Promise<EmailAlertItem> {
    const data: Prisma.EmailAlertUpdateInput = {};
    if (dto.email !== undefined) {
      data.email = dto.email;
    }
    if (dto.events !== undefined) {
      data.events = dto.events;
    }
    if (dto.active !== undefined) {
      data.active = dto.active;
    }

    const alert = await this.prisma.emailAlert.update({
      where: { id },
      data,
    });
    return toEmailAlertItem(alert);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.emailAlert.delete({
      where: { id },
    });
  }

  async test(id: string): Promise<WebhookTestResult> {
    this.assertEnabled();
    const alert = await this.prisma.emailAlert.findFirst({
      where: { id },
      select: { email: true },
    });
    if (!alert) {
      throw new NotFoundException(`Email alert ${id} not found`);
    }
    const { subject, text, html } = formatEmail(samplePayload());
    try {
      await this.mailer.send(alert.email, subject, text, html);
      return { delivered: true, status: null };
    } catch {
      return { delivered: false, status: null };
    }
  }

  private assertEnabled(): void {
    if (!this.mailer.enabled) {
      throw new BadRequestException(DISABLED_MESSAGE);
    }
  }
}

function samplePayload(): AlertBatchPayload {
  const occurredAt = new Date().toISOString();
  return {
    event: 'alerts.batch',
    scope: 'owned_apps',
    occurredAt,
    window: { from: '2026-07-21', to: '2026-07-22' },
    totals: { events: 5, apps: 2 },
    apps: [
      {
        app: { id: 'a', name: 'Sample App', store: 'APP_STORE', country: 'us' },
        rankDrops: [
          {
            event: 'rank.dropped',
            occurredAt,
            app: { id: 'a', name: 'Sample App' },
            keyword: {
              id: 'k1',
              text: 'habit tracker',
              store: 'APP_STORE',
              country: 'us',
            },
            from: 4,
            to: 12,
            fromDepth: RANK_DEPTH,
            toDepth: RANK_DEPTH,
            threshold: 5,
          },
        ],
        rankImprovements: [],
        serpEntrants: [
          {
            event: 'serp.entrant',
            occurredAt,
            keyword: {
              id: 'k1',
              text: 'habit tracker',
              store: 'APP_STORE',
              country: 'us',
            },
            date: '2026-07-22',
            entrants: [
              {
                position: 3,
                storeAppId: 'newcomer',
                title: 'Newcomer',
                appId: null,
                isCompetitor: false,
              },
            ],
          },
        ],
        changes: [
          {
            event: 'metadata.changed',
            occurredAt,
            app: { id: 'a', name: 'Sample App', isCompetitor: false },
            changes: [
              { field: 'title', before: 'Old title', after: 'New title' },
            ],
          },
        ],
        negativeReviews: [
          {
            event: 'review.negative',
            occurredAt,
            app: { id: 'a', name: 'Sample App' },
            review: {
              score: 2,
              title: 'Buggy',
              text: 'Crashes on launch after the latest update.',
              version: '3.1.0',
              reviewedAt: null,
            },
          },
        ],
        actions: [],
        competitors: [],
      },
      {
        app: {
          id: 'b',
          name: 'Second App',
          store: 'GOOGLE_PLAY',
          country: 'gb',
        },
        rankDrops: [],
        rankImprovements: [
          {
            event: 'rank.improved',
            occurredAt,
            app: { id: 'b', name: 'Second App' },
            keyword: {
              id: 'k2',
              text: 'budget planner',
              store: 'GOOGLE_PLAY',
              country: 'de',
            },
            from: 18,
            to: 9,
            fromDepth: RANK_DEPTH,
            toDepth: RANK_DEPTH,
            threshold: 5,
          },
        ],
        serpEntrants: [],
        changes: [],
        negativeReviews: [],
        actions: [],
        competitors: [],
      },
    ],
    events: [],
  };
}
