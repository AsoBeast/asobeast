import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { SentryModule } from '@sentry/nestjs/setup';
import { AccountModule } from './account/account.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ShutdownReporter } from './graceful-shutdown';
import { AlertsModule } from './alerts/alerts.module';
import { BillingModule } from './billing/billing.module';
import { AuthGuard } from './auth/guards/auth.guard';
import { EntitlementGuard } from './auth/guards/entitlement.guard';
import { SuspensionGuard } from './auth/abuse/suspension.guard';
import { TokenScopeGuard } from './auth/guards/token-scope.guard';
import { RateLimitGuard } from './auth/rate-limit/rate-limit.guard';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { LoggingModule } from './common/logging/logging.module';
import { ObservabilityModule } from './observability/observability.module';
import { TenancyModule } from './common/tenancy/tenancy.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ActionsModule } from './actions/actions.module';
import { AppsModule } from './apps/apps.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CompetitorsModule } from './competitors/competitors.module';
import { McpModule } from './mcp/mcp.module';
import { MetadataModule } from './metadata/metadata.module';
import { validateEnv } from './config/env';
import { HealthModule } from './health/health.module';
import { QuotaModule } from './auth/quota.module';
import { JobsModule } from './jobs/jobs.module';
import { MetricsModule } from './metrics/metrics.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SupportModule } from './support/support.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validateEnv,
    }),
    TenancyModule,
    LoggingModule,
    ObservabilityModule,
    PrismaModule,
    AuthModule,
    QuotaModule,
    HealthModule,
    JobsModule,
    MetricsModule,
    AppsModule,
    AnalyticsModule,
    AuditModule,
    ActionsModule,
    McpModule,
    MetadataModule,
    CompetitorsModule,
    AlertsModule,
    ReviewsModule,
    BillingModule,
    AccountModule,
    SupportModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ShutdownReporter,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: EntitlementGuard },
    { provide: APP_GUARD, useClass: SuspensionGuard },
    { provide: APP_GUARD, useClass: TokenScopeGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
export class AppModule {}
