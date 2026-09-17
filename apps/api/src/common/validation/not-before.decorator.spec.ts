import { validate } from 'class-validator';
import { NotBefore } from './not-before.decorator';

class Window {
  from?: string;

  @NotBefore('from')
  to?: string;
}

function windowOf(from: string | undefined, to: string | undefined): Window {
  return Object.assign(new Window(), { from, to });
}

async function messagesFor(window: Window): Promise<string[]> {
  const errors = await validate(window);
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('NotBefore', () => {
  it('accepts a window that starts and ends on the same day', async () => {
    await expect(
      messagesFor(windowOf('2026-09-01', '2026-09-01')),
    ).resolves.toEqual([]);
  });

  it('refuses an end before the start', async () => {
    await expect(
      messagesFor(windowOf('2026-09-15', '2026-09-01')),
    ).resolves.toEqual(['to must not be before from']);
  });

  it('leaves a window without a start to its default', async () => {
    await expect(
      messagesFor(windowOf(undefined, '2026-09-01')),
    ).resolves.toEqual([]);
  });

  it('compares timestamps by the utc day they fall on', async () => {
    await expect(
      messagesFor(windowOf('2026-09-01T18:00:00Z', '2026-09-01T06:00:00Z')),
    ).resolves.toEqual([]);
    await expect(
      messagesFor(windowOf('2026-09-02T00:30:00+02:00', '2026-09-01')),
    ).resolves.toEqual([]);
    await expect(
      messagesFor(windowOf('2026-09-02T00:00:00Z', '2026-09-01T23:59:59Z')),
    ).resolves.toEqual(['to must not be before from']);
  });
});
