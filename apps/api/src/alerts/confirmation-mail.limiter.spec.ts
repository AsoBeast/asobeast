import { ReplyError, type Redis } from 'ioredis';
import { sha256 } from '../auth/password-hash';
import { RequestThrottledError } from '../auth/rate-limit/rate-limit.errors';
import { RedisUnavailableError } from '../redis/redis.errors';
import { FailFastRedis } from '../redis/fail-fast-redis';
import {
  CONFIRMATIONS_PER_RECIPIENT_PER_DAY,
  CONFIRMATIONS_PER_WORKSPACE_PER_DAY,
  ConfirmationMailLimiter,
} from './confirmation-mail.limiter';

const NOW = new Date('2026-10-11T22:00:00Z');

const SECONDS_TO_MIDNIGHT = 7_200;

const AnsweredError = ReplyError as unknown as new (message: string) => Error;

describe('ConfirmationMailLimiter', () => {
  const evaluate = jest.fn<Promise<unknown>, [string, number, ...unknown[]]>();
  const limiter = new ConfirmationMailLimiter(
    new FailFastRedis({ eval: evaluate } as unknown as Redis),
  );

  const claimed = () => {
    const [, count, ...args] = evaluate.mock.calls[0];
    return { keys: args.slice(0, count), rest: args.slice(count) };
  };

  const recipientKeyOf = async (address: string): Promise<string> => {
    evaluate.mockClear();
    await limiter.claim('ws_1', address, NOW);
    return claimed().keys[1];
  };

  beforeEach(() => {
    evaluate.mockReset().mockResolvedValue(0);
  });

  it('lets the first confirmation of the day through', async () => {
    await expect(limiter.claim('ws_1', 'a@example.net', NOW)).resolves.toEqual(
      expect.any(Function),
    );
  });

  it('gives back exactly the allowances it counted', async () => {
    const refund = await limiter.claim('ws_1', 'a@example.net', NOW);
    const { keys } = claimed();

    await refund();

    const [, count, ...refunded] = evaluate.mock.calls[1];
    expect(count).toBe(2);
    expect(refunded).toEqual(keys);
  });

  it('gives the allowances back only once however often it is called', async () => {
    const refund = await limiter.claim('ws_1', 'a@example.net', NOW);

    await refund();
    await refund();

    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it('runs one refund for calls made at the same time', async () => {
    const refund = await limiter.claim('ws_1', 'a@example.net', NOW);

    await expect(Promise.all([refund(), refund()])).resolves.toEqual([
      true,
      true,
    ]);

    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it('reports a refund redis answered with an error and lets a later call retry it', async () => {
    const refund = await limiter.claim('ws_1', 'a@example.net', NOW);
    evaluate.mockRejectedValueOnce(
      new AnsweredError('NOSCRIPT No matching script'),
    );

    await expect(refund()).resolves.toBe(false);
    await expect(refund()).resolves.toBe(true);
    await expect(refund()).resolves.toBe(true);

    expect(evaluate).toHaveBeenCalledTimes(3);
  });

  it('reports a refund redis was not there to take and lets a later call retry it', async () => {
    const refund = await limiter.claim('ws_1', 'a@example.net', NOW);
    evaluate.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

    await expect(refund()).resolves.toBe(false);
    await expect(refund()).resolves.toBe(true);
  });

  it('checks the workspace allowance before the recipient in one atomic step', async () => {
    await limiter.claim('ws_1', 'A@Example.net', NOW);

    expect(evaluate).toHaveBeenCalledTimes(1);
    const { keys, rest } = claimed();
    expect(keys[0]).toMatch(/^asobeast:confirmation:ws_1:workspace:/);
    expect(keys[1]).toMatch(/^asobeast:confirmation:[0-9a-f]{64}:recipient:/);
    expect(rest).toEqual([
      CONFIRMATIONS_PER_WORKSPACE_PER_DAY,
      CONFIRMATIONS_PER_RECIPIENT_PER_DAY,
      SECONDS_TO_MIDNIGHT,
    ]);
  });

  it('counts one recipient under one key whatever the letter case', async () => {
    await limiter.claim('ws_1', 'A@Example.net', NOW);
    await limiter.claim('ws_2', 'a@example.net', NOW);

    const recipients = evaluate.mock.calls.map(
      ([, , , recipient]) => recipient,
    );
    expect(recipients[0]).toBe(recipients[1]);
  });
  it.each([
    ['a+news@example.net', 'a@example.net'],
    ['a+news+more@example.net', 'a@example.net'],
    ['"a"@example.net', 'a@example.net'],
    ['person@bücher.de', 'person@xn--bcher-kva.de'],
    ['person@BÜCHER.de.', 'person@xn--bcher-kva.de'],
    ['First.Last+x@googlemail.com', 'firstlast@gmail.com'],
  ])('counts %s as the mailbox of %s', async (spelling, mailbox) => {
    expect(await recipientKeyOf(spelling)).toBe(await recipientKeyOf(mailbox));
  });

  it.each([
    ['a@example.net', 'b@example.net'],
    ['a@example.net', 'a@example.org'],
    ['+a@example.net', '+b@example.net'],
    ['first.last@outlook.com', 'firstlast@outlook.com'],
  ])('keeps %s and %s apart', async (first, second) => {
    expect(await recipientKeyOf(first)).not.toBe(await recipientKeyOf(second));
  });

  it('keeps the key of an address that is already a plain mailbox', async () => {
    expect(await recipientKeyOf('a@example.net')).toContain(
      `:${sha256('a@example.net')}:recipient:`,
    );
  });

  it('refuses the confirmation after the workspace allowance', async () => {
    evaluate.mockResolvedValue(1);

    const refused = limiter.claim('ws_1', 'a@example.net', NOW);

    await expect(refused).rejects.toBeInstanceOf(RequestThrottledError);
    await expect(refused).rejects.toMatchObject({
      retryAfterSeconds: SECONDS_TO_MIDNIGHT,
      message: expect.stringContaining('this workspace') as string,
    });
  });

  it('refuses the confirmation after the recipient allowance', async () => {
    evaluate.mockResolvedValue(2);

    await expect(
      limiter.claim('ws_1', 'a@example.net', NOW),
    ).rejects.toMatchObject({
      retryAfterSeconds: SECONDS_TO_MIDNIGHT,
      message: expect.stringContaining('this recipient') as string,
    });
  });

  it('fails closed while redis is unreachable', async () => {
    evaluate.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(
      limiter.claim('ws_1', 'a@example.net', NOW),
    ).rejects.toBeInstanceOf(RedisUnavailableError);
  });
});
