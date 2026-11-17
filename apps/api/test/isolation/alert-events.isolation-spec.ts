import { getQueueToken } from '@nestjs/bullmq';
import { Prisma } from '@prisma/client';
import type { AlertEventList } from '@asobeast/shared';
import { Queue } from 'bullmq';
import { AlertsModule } from '../../src/alerts/alerts.module';
import { InstantAlertRelay } from '../../src/alerts/instant-alert-relay';
import { appDelisted } from '../../src/alerts/listing-events.fixture';
import { drop } from '../../src/alerts/rank-events.fixture';
import { DeliverAlertPayload, JOBS, QUEUES } from '../../src/jobs/jobs.types';
import { mcpAs, textOf } from '../helpers/mcp-rpc';
import {
  createIsolationFixture,
  IsolationFixture,
  IsolationWorkspace,
} from './fixture';

describe('GET /alerts/events isolation', () => {
  let fixture: IsolationFixture;
  const rowIds = new Map<string, string>();

  const seedEvent = async (workspace: IsolationWorkspace): Promise<void> => {
    const payload = drop({
      app: { id: workspace.appleAppId, name: workspace.email },
      keyword: {
        id: workspace.keywordId,
        text: 'habit tracker',
        store: 'APP_STORE',
        country: 'us',
      },
    });
    const now = new Date();
    const row = await fixture.db.alertEvent.create({
      data: {
        workspaceId: workspace.id,
        event: payload.event,
        appId: workspace.appleAppId,
        keywordId: workspace.keywordId,
        dedupeKey: `rank:${workspace.appleAppId}:feed-isolation`,
        payload: payload as unknown as Prisma.InputJsonValue,
        createdAt: now,
        flushedAt: now,
      },
    });
    rowIds.set(workspace.id, row.id);
  };

  const feedOf = async (workspace: IsolationWorkspace, query = '') => {
    const response = await workspace.agent
      .get(`/alerts/events${query}`)
      .expect(200);
    return response.body as AlertEventList;
  };

  beforeAll(async () => {
    fixture = await createIsolationFixture();
    await seedEvent(fixture.a);
    await seedEvent(fixture.b);
  }, 60_000);

  afterAll(async () => {
    await fixture.db.alertEvent.deleteMany({
      where: { id: { in: [...rowIds.values()] } },
    });
    await fixture.close();
  });

  it.each(['a', 'b'] as const)(
    'lists only the events of workspace %s',
    async (side) => {
      const own = fixture[side];
      const other = fixture[side === 'a' ? 'b' : 'a'];

      const body = await feedOf(own);

      expect(body.events.map((event) => event.id)).toContain(
        rowIds.get(own.id),
      );
      expect(body.events.map((event) => event.id)).not.toContain(
        rowIds.get(other.id),
      );
      expect(JSON.stringify(body)).not.toContain(other.appleAppId);
    },
  );

  it('lists only the caller workspace events through alert_events', async () => {
    const envelope = await mcpAs(fixture.app, fixture.a.token).callTool(
      'alert_events',
      {},
    );
    const body = JSON.parse(textOf(envelope)) as AlertEventList;

    expect(body.events.map((event) => event.id)).toContain(
      rowIds.get(fixture.a.id),
    );
    expect(textOf(envelope)).not.toContain(fixture.b.appleAppId);
  });

  it('answers 404 for an app of the other workspace', async () => {
    await fixture.a.agent
      .get(`/alerts/events?appId=${fixture.b.appleAppId}`)
      .expect(404);
  });

  it('relays an instant alert only to the channels of its own workspace', async () => {
    const hooks = await Promise.all(
      [fixture.a, fixture.b].map((workspace) =>
        fixture.db.webhook.create({
          data: {
            workspaceId: workspace.id,
            url: `https://hooks.example.com/relay-${workspace.id}`,
            events: ['app.delisted'],
          },
        }),
      ),
    );
    const payload = appDelisted({
      app: {
        id: fixture.a.appleAppId,
        name: fixture.a.email,
        isCompetitor: false,
      },
    });
    const event = await fixture.db.alertEvent.create({
      data: {
        workspaceId: fixture.a.id,
        event: payload.event,
        appId: fixture.a.appleAppId,
        dedupeKey: `delisted:${fixture.a.appleAppId}:relay-isolation`,
        payload: payload as unknown as Prisma.InputJsonValue,
        flushedAt: new Date(),
        relay: { create: { workspaceId: fixture.a.id } },
      },
    });
    const queue = fixture.app
      .select(AlertsModule)
      .get<Queue<DeliverAlertPayload>>(getQueueToken(QUEUES.ALERTS));
    const hookIds = new Set(hooks.map((hook) => hook.id));
    try {
      await fixture.app.get(InstantAlertRelay).relayEveryWorkspace();

      const relayed = (
        await queue.getJobs(['wait', 'paused', 'delayed'])
      ).filter(
        (job) =>
          job.name === JOBS.DELIVER_ALERT && hookIds.has(job.data.webhookId),
      );
      expect(relayed).toHaveLength(1);
      expect(relayed[0].data).toMatchObject({
        webhookId: hooks[0].id,
        workspaceId: fixture.a.id,
      });
    } finally {
      await fixture.db.alertEvent.delete({ where: { id: event.id } });
      await fixture.db.webhook.deleteMany({
        where: { id: { in: [...hookIds] } },
      });
    }
  });
});
