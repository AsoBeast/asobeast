import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EntryStep } from '@asobeast/shared';
import type { Env } from '../config/env';
import type { AccountUser } from './auth.types';
import { EmailVerificationService } from './email-verification.service';
import { isEntitled } from './entitlement';
import { entryStepOf, heldPlanOf } from './entry-step';

@Injectable()
export class EntrySteps {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly verification: EmailVerificationService,
  ) {}

  stepFor(user: AccountUser, now = new Date()): EntryStep | undefined {
    return entryStepOf({
      billing: this.config.get('BILLING_ENABLED', { infer: true }),
      verificationRequired: this.verification.required,
      emailVerified: user.emailVerifiedAt !== null,
      role: user.role,
      entitled: isEntitled(user.workspace, now),
      heldPlan: heldPlanOf(user.workspace),
    });
  }
}
