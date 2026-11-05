import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import type { AlertDeliveriesService } from './alert-deliveries.service';
import type { AlertFlushService } from './alert-flush.service';
import type { DefaultAlertsService } from './default-alerts.service';
import { AlertsController } from './alerts.controller';
import type { MailerService } from './mailer.service';

const controller = (
  enabled: boolean,
  origin: string | null,
  threshold = 5,
  pending = true,
) =>
  new AlertsController(
    { enabled, origin } as MailerService,
    {} as AlertDeliveriesService,
    {} as AlertFlushService,
    { get: () => threshold } as unknown as ConfigService<Env, true>,
    { pending: () => Promise.resolve(pending) } as DefaultAlertsService,
  );

describe('AlertsController.config', () => {
  it.each([
    [false, 'https://aso.example.com', 'smtp'],
    [true, null, 'https'],
    [true, 'http://localhost:3001', 'https'],
    [true, 'https://aso.example.com', null],
  ])('answers mail %p at %p as needing %p', async (enabled, origin, need) => {
    await expect(controller(enabled, origin).config()).resolves.toEqual({
      emailEnabled: enabled,
      rankDropThreshold: 5,
      essentialAlertsNeed: need,
      essentialAlertsPending: true,
    });
  });

  it('answers the instance rank drop threshold', async () => {
    await expect(controller(true, null, 8).config()).resolves.toMatchObject({
      rankDropThreshold: 8,
    });
  });

  it('answers that a settled workspace waits for no essential alerts', async () => {
    await expect(
      controller(true, 'https://aso.example.com', 5, false).config(),
    ).resolves.toMatchObject({ essentialAlertsPending: false });
  });
});
