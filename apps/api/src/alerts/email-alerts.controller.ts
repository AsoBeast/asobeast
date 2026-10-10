import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { EmailAlertItem, WebhookTestResult } from '@asobeast/shared';
import { Public } from '../auth/decorators/public.decorator';
import { RetryAfterThrottlerGuard } from '../auth/rate-limit/retry-after-throttler.guard';
import { CreateEmailAlertDto } from './dto/create-email-alert.dto';
import { UnsubscribeEmailAlertDto } from './dto/unsubscribe-email-alert.dto';
import { UpdateEmailAlertDto } from './dto/update-email-alert.dto';
import { EmailAlertUnsubscribe } from './email-alert-unsubscribe.service';
import { EmailAlertsService } from './email-alerts.service';

@ApiTags('email-alerts')
@Controller('email-alerts')
export class EmailAlertsController {
  constructor(
    private readonly emailAlerts: EmailAlertsService,
    private readonly unsubscribes: EmailAlertUnsubscribe,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List configured email alerts' })
  list(): Promise<EmailAlertItem[]> {
    return this.emailAlerts.list();
  }

  @Post()
  @ApiOperation({ summary: 'Register an email alert' })
  create(@Body() dto: CreateEmailAlertDto): Promise<EmailAlertItem> {
    return this.emailAlerts.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an email alert' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmailAlertDto,
  ): Promise<EmailAlertItem> {
    return this.emailAlerts.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an email alert' })
  remove(@Param('id') id: string): Promise<void> {
    return this.emailAlerts.remove(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Send a sample email to an alert recipient' })
  test(@Param('id') id: string): Promise<WebhookTestResult> {
    return this.emailAlerts.test(id);
  }

  @Post(':id/unsubscribe')
  @Public()
  @HttpCode(204)
  @UseGuards(RetryAfterThrottlerGuard)
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Stop one email alert from the link in its own message (RFC 8058 one click)',
  })
  unsubscribe(
    @Param('id') id: string,
    @Query() query: UnsubscribeEmailAlertDto,
  ): Promise<void> {
    return this.unsubscribes.unsubscribe(id, query.token);
  }
}
