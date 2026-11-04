import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import type { AlertDeliveriesService } from './alert-deliveries.service';
import type { AlertFlushService } from './alert-flush.service';
import { AlertsController } from './alerts.controller';
import type { MailerService } from './mailer.service';

const controller = (enabled: boolean, origin: string | null, threshold = 5) =>
  new AlertsController(
    { enabled, origin } as MailerService,
    {} as AlertDeliveriesService,
    {} as AlertFlushService,
    { get: () => threshold } as unknown as ConfigService<Env, true>,
  );

describe('AlertsController.config', () => {
  it.each([
    [false, 'https://aso.example.com', 'smtp'],
    [true, null, 'https'],
    [true, 'http://localhost:3001', 'https'],
    [true, 'https://aso.example.com', null],
  ])('answers mail %p at %p as needing %p', (enabled, origin, need) => {
    expect(controller(enabled, origin).config()).toEqual({
      emailEnabled: enabled,
      rankDropThreshold: 5,
      essentialAlertsNeed: need,
    });
  });

  it('answers the instance rank drop threshold', () => {
    expect(controller(true, null, 8).config().rankDropThreshold).toBe(8);
  });
});
