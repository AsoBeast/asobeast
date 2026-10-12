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
import type { AccountUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RetryAfterThrottlerGuard } from '../auth/rate-limit/retry-after-throttler.guard';
import { AlertLinkTokenDto } from './dto/alert-link-token.dto';
import { CreateEmailAlertDto } from './dto/create-email-alert.dto';
import { UpdateEmailAlertDto } from './dto/update-email-alert.dto';
import { EmailAlertConfirmationClaim } from './email-alert-confirmation-claim.service';
import { EmailAlertUnsubscribe } from './email-alert-unsubscribe.service';
import { EmailAlertsService } from './email-alerts.service';

@ApiTags('email-alerts')
@Controller('email-alerts')
export class EmailAlertsController {
  constructor(
    private readonly emailAlerts: EmailAlertsService,
    private readonly unsubscribes: EmailAlertUnsubscribe,
    private readonly confirmations: EmailAlertConfirmationClaim,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List configured email alerts' })
  list(): Promise<EmailAlertItem[]> {
    return this.emailAlerts.list();
  }

  @Post()
  @UseGuards(RetryAfterThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register an email alert' })
  create(
    @CurrentUser() user: AccountUser,
    @Body() dto: CreateEmailAlertDto,
  ): Promise<EmailAlertItem> {
    return this.emailAlerts.create(dto, user.email);
  }

  @Patch(':id')
  @UseGuards(RetryAfterThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Update an email alert' })
  update(
    @CurrentUser() user: AccountUser,
    @Param('id') id: string,
    @Body() dto: UpdateEmailAlertDto,
  ): Promise<EmailAlertItem> {
    return this.emailAlerts.update(id, dto, user.email);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an email alert' })
  remove(@Param('id') id: string): Promise<void> {
    return this.emailAlerts.remove(id);
  }

  @Post(':id/test')
  @UseGuards(RetryAfterThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Send a sample email to a confirmed alert recipient',
  })
  test(@Param('id') id: string): Promise<WebhookTestResult> {
    return this.emailAlerts.test(id);
  }

  @Post(':id/resend-confirmation')
  @HttpCode(204)
  @UseGuards(RetryAfterThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send the recipient a new confirmation email' })
  resendConfirmation(
    @CurrentUser() user: AccountUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.emailAlerts.resendConfirmation(id, user.email);
  }

  @Post(':id/confirm')
  @Public()
  @HttpCode(204)
  @UseGuards(RetryAfterThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Confirm an alert recipient from the link in the confirmation email',
  })
  confirm(
    @Param('id') id: string,
    @Query() query: AlertLinkTokenDto,
  ): Promise<void> {
    return this.confirmations.confirm(id, query.token);
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
    @Query() query: AlertLinkTokenDto,
  ): Promise<void> {
    return this.unsubscribes.unsubscribe(id, query.token);
  }
}
