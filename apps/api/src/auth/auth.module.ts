import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env';
import { AccountPlanService } from './account-plan.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WorkspaceTeamController } from './workspace-team.controller';
import { WorkspaceTeamService } from './workspace-team.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import { PublicWebUrl } from './public-web-url';
import { RecoveryMailer } from './recovery-mailer';
import { VerificationMailer } from './verification-mailer';
import { AlertsModule } from '../alerts/alerts.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { DailyCapacity } from '../jobs/daily-capacity.service';
import { SignupCapacityGate } from './signup-capacity.gate';

@Module({
  imports: [
    AlertsModule,
    RateLimitModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('AUTH_SECRET', { infer: true }),
        signOptions: {
          expiresIn: `${config.get('AUTH_SESSION_DAYS', { infer: true })}d`,
        },
      }),
    }),
  ],
  controllers: [AuthController, WorkspaceTeamController],
  providers: [
    AuthService,
    AccountPlanService,
    WorkspaceTeamService,
    EmailVerificationService,
    PasswordResetService,
    PublicWebUrl,
    VerificationMailer,
    RecoveryMailer,
    SignupCapacityGate,
    DailyCapacity,
  ],
  exports: [AuthService, SignupCapacityGate],
})
export class AuthModule {}
