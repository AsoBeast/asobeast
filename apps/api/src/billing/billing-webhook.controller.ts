import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { BillingEventQueue } from './billing-event-queue';
import { BillingWebhookService } from './billing-webhook.service';

@Controller('billing')
export class BillingWebhookController {
  constructor(
    private readonly webhook: BillingWebhookService,
    private readonly events: BillingEventQueue,
  ) {}

  @Post('webhook')
  @Public()
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async receive(
    @Req() request: Request,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    const event = this.webhook.verify(rawBodyOf(request), signature);
    const { pending } = await this.webhook.receive(event);
    if (pending) await this.events.enqueue(event.id);
    return { received: true };
  }
}

function rawBodyOf(request: Request): Buffer {
  const raw = (request as Request & { rawBody?: Buffer }).rawBody;
  return raw ?? Buffer.from('');
}
