import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type {
  BillingCatalog,
  BillingReconcileReport,
  BillingSession,
} from '@asobeast/shared';
import { AllowUnentitled } from '../auth/decorators/allow-unentitled.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OwnerGuard } from '../auth/guards/owner.guard';
import type { AccountUser } from '../auth/auth.types';
import { BillingService } from './billing.service';
import { BillingReconciler } from './billing-reconciler.service';
import { CheckoutDto } from './dto/checkout.dto';
import { ReconcileDto } from './dto/reconcile.dto';
import { RetryAfterThrottlerGuard } from '../auth/rate-limit/retry-after-throttler.guard';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly reconciler: BillingReconciler,
  ) {}

  @Get('catalog')
  @AllowUnentitled()
  @ApiOperation({ summary: 'Plans available to buy and their price ids' })
  catalog(): BillingCatalog {
    return this.billing.catalog();
  }

  @Post('checkout')
  @AllowUnentitled()
  @UseGuards(OwnerGuard, RetryAfterThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Start a Stripe Checkout session for a plan' })
  async checkout(
    @CurrentUser() user: AccountUser,
    @Body() dto: CheckoutDto,
  ): Promise<BillingSession> {
    return { url: await this.billing.checkout(user, dto.priceId) };
  }

  @Post('portal')
  @AllowUnentitled()
  @UseGuards(OwnerGuard, RetryAfterThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Open the Stripe customer portal for this workspace',
  })
  async portal(@CurrentUser() user: AccountUser): Promise<BillingSession> {
    return { url: await this.billing.portal(user) };
  }

  @Post('reconcile')
  @AllowUnentitled()
  @UseGuards(OwnerGuard, RetryAfterThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Reconcile this workspace against Stripe now' })
  @ApiBody({ type: ReconcileDto, required: false })
  reconcile(
    @CurrentUser() user: AccountUser,
    @Body() dto: ReconcileDto,
  ): Promise<BillingReconcileReport> {
    return this.reconciler.reconcileOne(user.workspaceId, dto.sessionId);
  }
}
