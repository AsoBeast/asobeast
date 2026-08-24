import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { JOBS, QUEUES } from '../jobs/jobs.types';
import { BillingWebhookService } from './billing-webhook.service';

@Controller('billing')
export class BillingWebhookController {
  constructor(
    private readonly webhook: BillingWebhookService,
    @InjectQueue(QUEUES.BILLING) private readonly queue: Queue,
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
    if (pending) {
      await this.queue.add(
        JOBS.BILLING_EVENT,
        { eventId: event.id },
        { jobId: `billing~${event.id}` },
      );
    }
    return { received: true };
  }
}

function rawBodyOf(request: Request): Buffer {
  const raw = (request as Request & { rawBody?: Buffer }).rawBody;
  return raw ?? Buffer.from('');
}
