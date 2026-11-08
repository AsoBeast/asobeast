import { Prisma } from '@prisma/client';
import { isDatabaseError, isDatabaseUnavailable } from './database-fault';

const known = (code: string, message: string, originalCode?: string) =>
  new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: '7.10.1',
    meta: originalCode
      ? { driverAdapterError: { cause: { originalCode } } }
      : undefined,
  });

describe('isDatabaseUnavailable', () => {
  it.each(['57P01', '57P02', '57P03', '08006', '53300'])(
    'recognizes postgres state %s',
    (state) => {
      expect(
        isDatabaseUnavailable(known('P2039', `Database error ${state}`, state)),
      ).toBe(true);
    },
  );

  it.each(['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2037'])(
    'recognizes prisma connection failure %s',
    (code) => {
      expect(isDatabaseUnavailable(known(code, 'connection problem'))).toBe(
        true,
      );
    },
  );

  it('recognizes the driver dropping the connection of a killed backend', () => {
    const dropped = new Error('Connection terminated unexpectedly');

    expect(isDatabaseUnavailable(dropped)).toBe(true);
    expect(isDatabaseError(dropped)).toBe(true);
  });

  it('recognizes a transaction that could not get a connection in time', () => {
    expect(
      isDatabaseUnavailable(
        known(
          'P2028',
          'Transaction API error: Unable to start a transaction in the given time.',
        ),
      ),
    ).toBe(true);
  });

  it('keeps a transaction that outlived its timeout as an ordinary failure', () => {
    expect(
      isDatabaseUnavailable(
        known(
          'P2028',
          'Transaction API error: A query cannot be executed on an expired transaction.',
        ),
      ),
    ).toBe(false);
  });

  it('keeps a constraint violation and a foreign error as ordinary failures', () => {
    expect(isDatabaseUnavailable(known('P2002', 'unique', '23505'))).toBe(
      false,
    );
    expect(isDatabaseUnavailable(new Error('57P03'))).toBe(false);
    expect(
      isDatabaseUnavailable(
        new Error('GOOGLE_PLAY search failed: Connection terminated'),
      ),
    ).toBe(false);
    expect(isDatabaseUnavailable('57P03')).toBe(false);
  });
});

describe('isDatabaseError', () => {
  it('names every prisma client error', () => {
    expect(isDatabaseError(known('P2002', 'unique'))).toBe(true);
    expect(
      isDatabaseError(
        new Prisma.PrismaClientUnknownRequestError('boom', {
          clientVersion: '7.10.1',
        }),
      ),
    ).toBe(true);
  });

  it('leaves other errors alone', () => {
    expect(isDatabaseError(new Error('socket hang up'))).toBe(false);
    expect(isDatabaseError(undefined)).toBe(false);
  });
});
