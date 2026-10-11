import { aiCompletion } from '../../src/ai/ai-completion.fixture';
import { AiClient, AiCompletion } from '../../src/ai/openai.client';
import { createIsolationFixture, IsolationFixture } from './fixture';

const DEFEND_EVIDENCE = {
  rule: 'keyword.defend',
  entrants: 3,
  entrantsAtOrAbove: 1,
  observedDays: 3,
};

describe('Action explanation isolation', () => {
  let fixture: IsolationFixture;
  let finish: (completion: AiCompletion) => void;
  const structured = jest.fn(
    () =>
      new Promise<AiCompletion>((resolve) => {
        finish = resolve;
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
    await new Promise((resolve) => setTimeout(resolve, 200));
    const stranger = fixture.b.agent
      .post(`/actions/${fixture.a.actionId}/explain`)
      .then((response) => response);
    await new Promise((resolve) => setTimeout(resolve, 200));
    finish(aiCompletion({ explanation: 'Private to ws_iso_a.' }));

    const [ownerResult, strangerResult] = await Promise.all([owner, stranger]);

    expect(strangerResult.status).toBe(404);
    expect(JSON.stringify(strangerResult.body)).not.toContain('Private');
    expect(ownerResult.status).toBe(200);
    expect(ownerResult.body).toMatchObject({
      explanation: 'Private to ws_iso_a.',
    });
    expect(structured).toHaveBeenCalledTimes(1);
  });
});
