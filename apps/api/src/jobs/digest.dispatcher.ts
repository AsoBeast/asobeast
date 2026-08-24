import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { DigestService } from '../analytics/digest.service';
import {
  WorkspaceFanOut,
  workspaceFailure,
} from '../common/tenancy/workspace-fanout';
import { Env } from '../config/env';

@Injectable()
export class DigestDispatcher {
  constructor(
    private readonly digest: DigestService,
    private readonly alerts: AlertsDispatcher,
    private readonly config: ConfigService<Env, true>,
    private readonly fanOut: WorkspaceFanOut,
  ) {}

  async run(): Promise<void> {
    const { failures } = await this.fanOut.each(
      'the weekly digest reports one workspace at a time',
      () => this.runForWorkspace(),
    );
    const failure = workspaceFailure(failures, 'failed to send its digest');
    if (failure) throw failure;
  }

  private async runForWorkspace(): Promise<void> {
    const reviewScoreMax = this.config.get('ALERT_REVIEW_SCORE_MAX', {
      infer: true,
    });
    const payload = await this.digest.buildDigest(reviewScoreMax);
    if (payload.apps.length === 0) {
      return;
    }
    await this.alerts.dispatch(payload);
  }
}
