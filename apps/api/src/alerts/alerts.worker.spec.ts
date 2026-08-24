import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { MetadataChangedPayload } from '@asobeast/shared';
import {
  DeliverAlertPayload,
  DeliverEmailPayload,
  JOBS,
} from '../jobs/jobs.types';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsWorker } from './alerts.worker';
import { MailerService } from './mailer.service';
import { WebhookDelivery } from './webhook-delivery';

const mockFetch = jest.fn<Promise<unknown>, unknown[]>();
jest.mock('undici', () => ({
  ...jest.requireActual<Record<string, unknown>>('undici'),
  fetch: (...args: unknown[]) => mockFetch(...args),
}));

const payload: MetadataChangedPayload = {
  event: 'metadata.changed',
  occurredAt: '2026-07-11T00:00:00.000Z',
  app: { id: 'app_1', name: 'Mine', isCompetitor: false },
  changes: [{ field: 'title', before: 'A', after: 'B' }],
};

function webhookJob(webhookId: string): Job<DeliverAlertPayload> {
  return {
    name: JOBS.DELIVER_ALERT,
    attemptsMade: 0,
    data: { webhookId, payload, workspaceId: 'ws_a' },
  } as unknown as Job<DeliverAlertPayload>;
}

function emailJob(emailAlertId: string): Job<DeliverEmailPayload> {
  return {
    name: JOBS.DELIVER_EMAIL,
    attemptsMade: 1,
    data: { emailAlertId, payload, workspaceId: 'ws_a' },
  } as unknown as Job<DeliverEmailPayload>;
}

describe('AlertsWorker', () => {
  const webhookFind = jest.fn();
  const emailFind = jest.fn();
  const deliveryCreate = jest.fn();
  const send = jest.fn();
  let worker: AlertsWorker;
  let delivery: WebhookDelivery;

  beforeEach(() => {
    webhookFind.mockReset();
    emailFind.mockReset();
    deliveryCreate.mockReset().mockResolvedValue(undefined);
    mockFetch.mockReset();
    send.mockReset();
    const prisma = {
      webhook: { findUnique: webhookFind },
      emailAlert: { findUnique: emailFind },
      alertDelivery: { create: deliveryCreate },
    } as unknown as PrismaService;
    const mailer = { send } as unknown as MailerService;
    delivery = new WebhookDelivery({
      get: () => false,
    } as unknown as ConfigService<Env, true>);
    worker = new AlertsWorker(prisma, delivery, mailer, new WorkspaceContext());
  });

  afterEach(() => delivery.onModuleDestroy());

  it('posts the payload and signs it when the webhook has a secret', async () => {
    webhookFind.mockResolvedValue({
      url: 'https://hooks.test/x',
      secret: 'topsecret',
    });
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await worker.process(webhookJob('wh_1'));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://hooks.test/x');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Asobeast-Event']).toBe('metadata.changed');
    expect(headers['X-Asobeast-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(deliveryCreate).toHaveBeenCalledWith({
      data: {
        channel: 'webhook',
        webhookId: 'wh_1',
        event: 'metadata.changed',
        status: 'success',
        detail: null,
        attempt: 1,
      },
    });
  });

  it('omits the signature header without a secret', async () => {
    webhookFind.mockResolvedValue({
      url: 'https://hooks.test/x',
      secret: null,
    });
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await worker.process(webhookJob('wh_1'));

    const [, init] = mockFetch.mock.calls[0] as [URL, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers).not.toHaveProperty('X-Asobeast-Signature');
  });

  it('throws so bullmq retries when the endpoint returns a non-2xx', async () => {
    webhookFind.mockResolvedValue({
      url: 'https://hooks.test/x',
      secret: null,
    });
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(worker.process(webhookJob('wh_1'))).rejects.toThrow();
    const [{ data }] = deliveryCreate.mock.calls[0] as [
      { data: { status: string; detail: string; attempt: number } },
    ];
    expect(data.status).toBe('failed');
    expect(data.detail).toContain('500');
    expect(data.attempt).toBe(1);
  });

  it('completes silently and logs nothing when the webhook was deleted mid-flight', async () => {
    webhookFind.mockResolvedValue(null);

    await expect(worker.process(webhookJob('wh_1'))).resolves.toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(deliveryCreate).not.toHaveBeenCalled();
  });

  it('never reaches the network for a webhook that points at a private address', async () => {
    webhookFind.mockResolvedValue({
      url: 'http://169.254.169.254/latest/meta-data/',
      secret: null,
    });

    await expect(worker.process(webhookJob('wh_1'))).rejects.toThrow(
      /private or reserved/,
    );
    expect(mockFetch).not.toHaveBeenCalled();
    const [{ data }] = deliveryCreate.mock.calls[0] as [
      { data: { status: string } },
    ];
    expect(data.status).toBe('failed');
  });

  it('sends a formatted email for an email job', async () => {
    emailFind.mockResolvedValue({ email: 'ops@example.com' });
    send.mockResolvedValue(undefined);

    await worker.process(emailJob('ea_1'));

    expect(send).toHaveBeenCalledTimes(1);
    const [to, subject] = send.mock.calls[0] as [string, string];
    expect(to).toBe('ops@example.com');
    expect(subject).toContain('[asobeast]');
    expect(deliveryCreate).toHaveBeenCalledWith({
      data: {
        channel: 'email',
        emailAlertId: 'ea_1',
        event: 'metadata.changed',
        status: 'success',
        detail: null,
        attempt: 2,
      },
    });
  });

  it('logs a failed row and throws so bullmq retries when the mailer fails', async () => {
    emailFind.mockResolvedValue({ email: 'ops@example.com' });
    send.mockRejectedValue(new Error('smtp down'));

    await expect(worker.process(emailJob('ea_1'))).rejects.toThrow('smtp down');
    const [{ data }] = deliveryCreate.mock.calls[0] as [
      { data: { channel: string; status: string; detail: string } },
    ];
    expect(data.channel).toBe('email');
    expect(data.status).toBe('failed');
    expect(data.detail).toBe('smtp down');
  });

  it('completes silently and logs nothing when the email alert was deleted mid-flight', async () => {
    emailFind.mockResolvedValue(null);

    await expect(worker.process(emailJob('ea_1'))).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
    expect(deliveryCreate).not.toHaveBeenCalled();
  });
});
