import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { describeWait } from '../auth/rate-limit/describe-wait';
import { RequestThrottledError } from '../auth/rate-limit/rate-limit.errors';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailAlertDto } from './dto/create-email-alert.dto';
import { UpdateEmailAlertDto } from './dto/update-email-alert.dto';
import { toEmailAlertItem } from './email-alerts.mapper';
import { AlertMail } from './alert-mail';
import type { ConfirmationRefund } from './confirmation-mail.limiter';
import { EmailAlertConfirmation } from './email-alert-confirmation.service';
import { MailerService } from './mailer.service';

const DISABLED_MESSAGE = 'Email alerts require SMTP configuration';

export const MAX_EMAIL_ALERTS = 25;

export const MAX_UNCONFIRMED_EMAIL_ALERTS = 5;

export const CONFIRMATION_RESEND_COOLDOWN_SECONDS = 60 * 60;

const EMAIL_ALERT_LOCK = 7_340_219;

interface Written {
  alert: EmailAlert;
  ask: boolean;
}

interface Saved extends Written {
  refund: ConfirmationRefund | null;
}

const NOT_SENT_MESSAGE = 'The confirmation email could not be sent';

const NO_LINK_MESSAGE =
  'The confirmation email cannot be sent until WEB_PUBLIC_URL is set on the API, because the link would have no host';

const ALREADY_CONFIRMED_MESSAGE = 'This recipient is already confirmed';

const COOLING_DOWN_MESSAGE = `A confirmation email was sent to this recipient less than ${describeWait(CONFIRMATION_RESEND_COOLDOWN_SECONDS)} ago.`;

const UNSUBSCRIBED_MESSAGE =
  'This recipient unsubscribed from the alert, so it is not asked again. Change the address to ask someone else to confirm';

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
    const workspaceId = this.workspace.require('an email alert');
    const confirmedAt = await this.confirmation.confirmationFor(dto.email);
    const saved = await this.underLock(workspaceId, async (tx) => {
      await assertRoomForAnother(tx);
      if (!confirmedAt) await assertRoomToWait(tx);
      const alert = await tx.emailAlert.create({
        data: {
          workspaceId,
          email: dto.email,
          events: dto.events,
          confirmedAt,
        },
      });
      return { alert, ask: !confirmedAt };
    });
    return this.answer(saved, requestedBy);
  }

  async update(
    id: string,
    dto: UpdateEmailAlertDto,
    requestedBy: string,
  ): Promise<EmailAlertItem> {
    const workspaceId = this.workspace.require('an email alert');
    const data: Prisma.EmailAlertUpdateInput = {
      email: dto.email,
      events: dto.events,
      active: dto.active,
    };
    const saved = await this.underLock(workspaceId, async (tx) => {
      const current = await tx.emailAlert.findFirst({ where: { id } });
      if (!current) throw missing(id);
      if (dto.email === undefined || sameAddress(current.email, dto.email)) {
        const alert = await tx.emailAlert.update({ where: { id }, data });
        return { alert, ask: false };
      }
      const confirmedAt = await this.confirmation.confirmationFor(dto.email);
      if (!confirmedAt) await assertRoomToWait(tx, id);
      const alert = await tx.emailAlert.update({
        where: { id },
        data: {
          ...data,
          confirmedAt,
          confirmationSentAt: null,
          unsubscribedAt: null,
        },
      });
      return { alert, ask: !confirmedAt };
    });
    return this.answer(saved, requestedBy);
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
    if (alert.unsubscribedAt) {
      throw new ConflictException(UNSUBSCRIBED_MESSAGE);
    }
    if (!this.confirmation.canSend) {
      throw new ServiceUnavailableException(NO_LINK_MESSAGE);
    }
    assertCooledDown(alert.confirmationSentAt);
    const refund = await this.confirmation.allowMailTo(alert.email);
    const outcome = await this.confirmation.issue(alert, requestedBy, refund);
    if (outcome === 'lost') {
      throw new RequestThrottledError(
        CONFIRMATION_RESEND_COOLDOWN_SECONDS,
        COOLING_DOWN_MESSAGE,
      );
    }
    if (outcome === 'failed') {
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

  private async underLock(
    workspaceId: string,
    write: (tx: Prisma.TransactionClient) => Promise<Written>,
  ): Promise<Saved> {
    const claimed: { refund: ConfirmationRefund | null } = { refund: null };
    try {
      return await this.prisma.withTransaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${EMAIL_ALERT_LOCK}, hashtext(${workspaceId}))`;
        const written = await write(tx);
        if (written.ask) {
          claimed.refund = await this.confirmation.allowMailTo(
            written.alert.email,
          );
        }
        return { ...written, refund: claimed.refund };
      });
    } catch (error) {
      await claimed.refund?.();
      throw error;
    }
  }

  private async answer(
    { alert, ask, refund }: Saved,
    requestedBy: string,
  ): Promise<EmailAlertItem> {
    if (!ask) return toEmailAlertItem(alert);
    return {
      ...toEmailAlertItem(alert),
      confirmationSent:
        (await this.confirmation.issue(alert, requestedBy, refund)) === 'sent',
    };
  }

  private async find(id: string): Promise<EmailAlert> {
    const alert = await this.prisma.emailAlert.findFirst({ where: { id } });
    if (!alert) throw missing(id);
    return alert;
  }

  private assertEnabled(): void {
    if (!this.mailer.enabled) {
      throw new BadRequestException(DISABLED_MESSAGE);
    }
  }
}

function missing(id: string): NotFoundException {
  return new NotFoundException(`Email alert ${id} not found`);
}

function sameAddress(current: string, next: string): boolean {
  return current.toLowerCase() === next.toLowerCase();
}

async function assertRoomForAnother(
  tx: Prisma.TransactionClient,
): Promise<void> {
  if ((await tx.emailAlert.count()) >= MAX_EMAIL_ALERTS) {
    throw new ForbiddenException(
      `A workspace can have at most ${MAX_EMAIL_ALERTS} email alerts`,
    );
  }
}

async function assertRoomToWait(
  tx: Prisma.TransactionClient,
  excluding?: string,
): Promise<void> {
  const waiting = await tx.emailAlert.count({
    where: { confirmedAt: null, unsubscribedAt: null, NOT: { id: excluding } },
  });
  if (waiting >= MAX_UNCONFIRMED_EMAIL_ALERTS) {
    throw new ForbiddenException(
      `A workspace can wait for at most ${MAX_UNCONFIRMED_EMAIL_ALERTS} recipients to confirm`,
    );
  }
}

function assertCooledDown(sentAt: Date | null, now = Date.now()): void {
  if (!sentAt) return;
  const waitSeconds = Math.ceil(
    (sentAt.getTime() + CONFIRMATION_RESEND_COOLDOWN_SECONDS * 1000 - now) /
      1000,
  );
  if (waitSeconds > 0) {
    throw new RequestThrottledError(waitSeconds, COOLING_DOWN_MESSAGE);
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
