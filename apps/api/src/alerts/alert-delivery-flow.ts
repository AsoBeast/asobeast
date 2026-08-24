import { AlertBatchPayload } from '@asobeast/shared';
import { DefaultJobOptions, FlowJob } from 'bullmq';
import { JOB_OPTIONS } from '../jobs/job-options';
import { JOBS, QUEUES } from '../jobs/jobs.types';
import { filterBatch } from './alert-batch-filter';

const ALERT_DELIVERY_DEDUPE_SECONDS = 7 * 24 * 60 * 60;

export const ALERT_DELIVERY_JOB_OPTIONS = {
  ...JOB_OPTIONS,
  removeOnComplete: { age: ALERT_DELIVERY_DEDUPE_SECONDS },
} satisfies DefaultJobOptions;

export interface DeliveryFlow {
  channel: string;
  flow: FlowJob;
}

interface CreateDeliveryFlowsInput {
  batches: { owned: AlertBatchPayload; competitors: AlertBatchPayload };
  workspaceId: string;
  flushId: string;
  kind: 'webhook' | 'email';
  subscription: { id: string; events: string[] };
  jobName: typeof JOBS.DELIVER_ALERT | typeof JOBS.DELIVER_EMAIL;
}

export function createDeliveryFlows(
  input: CreateDeliveryFlowsInput,
): DeliveryFlow[] {
  const allowed = new Set(input.subscription.events);
  const owned = filterBatch(input.batches.owned, allowed);
  const competitors = filterBatch(input.batches.competitors, allowed);
  if (!owned && !competitors) return [];
  const node = (payload: AlertBatchPayload, child: boolean): FlowJob => ({
    name: input.jobName,
    queueName: QUEUES.ALERTS,
    data:
      input.kind === 'webhook'
        ? {
            webhookId: input.subscription.id,
            payload,
            workspaceId: input.workspaceId,
          }
        : {
            emailAlertId: input.subscription.id,
            payload,
            workspaceId: input.workspaceId,
          },
    opts: {
      ...ALERT_DELIVERY_JOB_OPTIONS,
      jobId: `flush~${input.flushId}~${input.kind}~${input.subscription.id}~${payload.scope}`,
      ...(child ? { removeDependencyOnFailure: true } : {}),
    },
  });
  const channel = `${input.kind}:${input.subscription.id}`;
  if (owned && competitors) {
    return [
      {
        channel,
        flow: {
          ...node(competitors, false),
          children: [node(owned, true)],
        },
      },
    ];
  }
  if (owned) return [{ channel, flow: node(owned, false) }];
  if (competitors) return [{ channel, flow: node(competitors, false) }];
  return [];
}
