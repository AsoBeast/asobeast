import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ACTION_PRIORITIES,
  ACTION_RULE_CATEGORY,
  ActionOpenedPayload,
  ActionPriority,
} from '@asobeast/shared';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { parseActionEvidence } from './actions.mapper';
import { OpenedAction } from './actions.generator';

export function meetsPriority(
  priority: ActionPriority,
  minimum: ActionPriority,
): boolean {
  return (
    ACTION_PRIORITIES.indexOf(priority) <= ACTION_PRIORITIES.indexOf(minimum)
  );
}

export function actionLink(
  baseUrl: string | undefined,
  actionId: string,
): string | null {
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/+$/, '')}/actions?action=${actionId}`;
}

@Injectable()
export class ActionsNotifier {
  private readonly logger = new Logger(ActionsNotifier.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly alerts: AlertsDispatcher,
    private readonly workspace: WorkspaceContext,
  ) {}

  async notify(opened: OpenedAction[], now = new Date()): Promise<number> {
    const minimum = this.config.get('ALERT_ACTIONS_MIN_PRIORITY', {
      infer: true,
    });
    const eligible = opened.filter((action) =>
      meetsPriority(action.priority, minimum),
    );
    if (eligible.length === 0) return 0;

    const workspaceId = this.workspace.require('an action alert');
    const foreign = eligible.find(
      (action) => action.workspaceId !== workspaceId,
    );
    if (foreign) {
      throw new Error(
        `action ${foreign.id} belongs to ${foreign.workspaceId}, not ${workspaceId}`,
      );
    }

    const payloads = await this.buildPayloads(eligible, now);
    for (const payload of payloads) {
      await this.alerts.dispatch(payload);
    }
    return payloads.length;
  }

  private async buildPayloads(
    opened: OpenedAction[],
    now: Date,
  ): Promise<ActionOpenedPayload[]> {
    const rows = await this.prisma.actionItem.findMany({
      where: { id: { in: opened.map((action) => action.id) } },
      select: {
        id: true,
        rule: true,
        evidence: true,
        app: {
          select: { id: true, name: true, store: true, country: true },
        },
        keyword: { select: { id: true, text: true } },
      },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const baseUrl = this.config.get('WEB_PUBLIC_URL', { infer: true });
    const occurredAt = now.toISOString();

    return opened.flatMap((action): ActionOpenedPayload[] => {
      const row = byId.get(action.id);
      if (!row) return [];
      const evidence = parseActionEvidence(row.rule, row.evidence);
      if (!evidence) {
        this.logger.warn(
          `action ${action.id} has unreadable evidence, skipping its alert`,
        );
        return [];
      }
      return [
        {
          event: 'action.opened',
          occurredAt,
          app: {
            id: row.app.id,
            name: row.app.name,
            store: row.app.store,
            country: row.app.country,
          },
          action: {
            id: action.id,
            rule: action.rule,
            category: ACTION_RULE_CATEGORY[action.rule],
            priority: action.priority,
            impact: action.impact,
            firstSeenAt: action.firstSeenAt.toISOString(),
            reopened: action.reopened,
          },
          keyword: row.keyword
            ? { id: row.keyword.id, text: row.keyword.text }
            : null,
          evidence,
          link: actionLink(baseUrl, action.id),
        },
      ];
    });
  }
}
