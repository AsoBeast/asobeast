import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_ALERTS_OUTCOMES,
  DefaultAlertsService,
  type DefaultAlertsOutcome,
} from '../alerts/default-alerts.service';
import {
  WorkspaceFanOut,
  workspaceFailure,
} from '../common/tenancy/workspace-fanout';
import { ActiveWorkspaces } from './active-workspaces';

export type DefaultAlertsTally = Record<DefaultAlertsOutcome, number>;

@Injectable()
export class DefaultAlertsRun {
  private readonly logger = new Logger(DefaultAlertsRun.name);

  constructor(
    private readonly active: ActiveWorkspaces,
    private readonly fanOut: WorkspaceFanOut,
    private readonly alerts: DefaultAlertsService,
  ) {}

  async run(date: string): Promise<DefaultAlertsTally> {
    const roster = await this.active.forDailyRun();
    const { results, failures } = await this.fanOut.eachOf(roster, () =>
      this.alerts.createFor(date),
    );
    const failure = workspaceFailure(
      failures,
      'failed to create its essential alerts',
    );
    if (failure) this.logger.error(failure.message, failure);
    return tally(results);
  }
}

function tally(outcomes: readonly DefaultAlertsOutcome[]): DefaultAlertsTally {
  const counts = Object.fromEntries(
    DEFAULT_ALERTS_OUTCOMES.map((outcome) => [outcome, 0]),
  ) as DefaultAlertsTally;
  for (const outcome of outcomes) counts[outcome] += 1;
  return counts;
}
