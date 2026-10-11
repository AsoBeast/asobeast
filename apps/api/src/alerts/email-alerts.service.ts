import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EmailAlert, Prisma } from '@prisma/client';
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
import { AlertMail } from './alert-mail';
import { EmailAlertConfirmation } from './email-alert-confirmation.service';
import { MailerService } from './mailer.service';

const DISABLED_MESSAGE = 'Email alerts require SMTP configuration';

const NOT_SENT_MESSAGE = 'The confirmation email could not be sent';

const ALREADY_CONFIRMED_MESSAGE = 'This recipient is already confirmed';

@Injectable()
export class EmailAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly workspace: WorkspaceContext,
    private readonly alertMail: AlertMail,
    private readonly confirmation: EmailAlertConfirmation,
  ) {}

  async list(): Promise<EmailAlertItem[]> {
    const alerts = await this.prisma.emailAlert.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return alerts.map(toEmailAlertItem);
  }

  async create(
    dto: CreateEmailAlertDto,
    requestedBy: string,
  ): Promise<EmailAlertItem> {
    this.assertEnabled();
    const alert = await this.prisma.emailAlert.create({
      data: {
        workspaceId: this.workspace.require('an email alert'),
        email: dto.email,
        events: dto.events,
        confirmedAt: await this.confirmation.confirmationFor(dto.email),
      },
    });
    if (!alert.confirmedAt) {
      await this.confirmation.issue(alert, requestedBy);
    }
    return toEmailAlertItem(alert);
  }

  async update(
    id: string,
    dto: UpdateEmailAlertDto,
    requestedBy: string,
  ): Promise<EmailAlertItem> {
    const data: Prisma.EmailAlertUpdateInput = {};
    if (dto.email !== undefined) {
      data.email = dto.email;
      if (await this.changesAddress(id, dto.email)) {
        data.confirmedAt = await this.confirmation.confirmationFor(dto.email);
        data.confirmationSentAt = null;
      }
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
    if (data.confirmedAt === null) {
      await this.confirmation.issue(alert, requestedBy);
    }
    return toEmailAlertItem(alert);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.emailAlert.delete({
      where: { id },
    });
  }

  async resendConfirmation(id: string, requestedBy: string): Promise<void> {
    this.assertEnabled();
    const alert = await this.find(id);
    if (alert.confirmedAt) {
      throw new ConflictException(ALREADY_CONFIRMED_MESSAGE);
    }
    if (!(await this.confirmation.issue(alert, requestedBy))) {
      throw new ServiceUnavailableException(NOT_SENT_MESSAGE);
    }
  }

  async test(id: string): Promise<WebhookTestResult> {
    this.assertEnabled();
    const alert = await this.find(id);
    if (!alert.confirmedAt) {
      return { delivered: false, status: null };
    }
    const mail = await this.alertMail.compose(id, alert.email, samplePayload());
    try {
      await this.mailer.send(mail);
      return { delivered: true, status: null };
    } catch {
      return { delivered: false, status: null };
    }
  }

  private async find(id: string): Promise<EmailAlert> {
    const alert = await this.prisma.emailAlert.findFirst({ where: { id } });
    if (!alert) {
      throw new NotFoundException(`Email alert ${id} not found`);
    }
    return alert;
  }

  private async changesAddress(id: string, email: string): Promise<boolean> {
    const current = await this.find(id);
    return current.email.toLowerCase() !== email.toLowerCase();
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
        rankMilestones: [],
        firstRankings: [],
        overtakes: [],
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
        rankMilestones: [],
        firstRankings: [],
        overtakes: [],
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
