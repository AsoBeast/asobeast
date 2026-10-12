import { aiCompletion } from '../../src/ai/ai-completion.fixture';
import { AiClient, AiCompletion } from '../../src/ai/openai.client';
import { createIsolationFixture, IsolationFixture } from './fixture';

const DEFEND_EVIDENCE = {
  rule: 'keyword.defend',
  entrants: [],
  entrantsAtOrAbove: 1,
  observedDays: 3,
};

const STRANGER_ANSWER_MS = 2_000;

describe('Action explanation isolation', () => {
  let fixture: IsolationFixture;
  let finish: (completion: AiCompletion) => void;
  let markWriting: () => void;
  const writing = new Promise<void>((resolve) => {
    markWriting = resolve;
  });
  const structured = jest.fn(
    () =>
      new Promise<AiCompletion>((resolve) => {
        finish = resolve;
        markWriting();
      }),
  );
  const aiClient: AiClient = { model: 'gpt-test', structured };

  beforeAll(async () => {
    fixture = await createIsolationFixture(aiClient);
    await fixture.db.actionItem.update({
      where: { id: fixture.a.actionId },
      data: { evidence: DEFEND_EVIDENCE },
    });
  }, 60_000);

  afterAll(() => fixture.close());

  it('does not give another workspace the explanation being written for an action it does not own', async () => {
    const owner = fixture.a.agent
      .post(`/actions/${fixture.a.actionId}/explain`)
      .then((response) => response);
    await writing;
    const stranger = fixture.b.agent
      .post(`/actions/${fixture.a.actionId}/explain`)
      .then((response) => response);
    try {
      const strangerResult = await Promise.race([
        stranger,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('The other workspace was kept waiting')),
            STRANGER_ANSWER_MS,
          ),
        ),
      ]);
      expect(strangerResult.status).toBe(404);
      expect(JSON.stringify(strangerResult.body)).not.toContain('Private');
    } finally {
      finish(aiCompletion({ explanation: 'Private to ws_iso_a.' }));
    }

    const ownerResult = await owner;
    expect(ownerResult.status).toBe(200);
    expect(ownerResult.body).toMatchObject({
      explanation: 'Private to ws_iso_a.',
    });
    expect(structured).toHaveBeenCalledTimes(1);
  });
});
