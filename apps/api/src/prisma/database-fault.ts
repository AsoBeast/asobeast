import { Prisma } from '@prisma/client';

const CONNECTION_FAILURES: ReadonlySet<string> = new Set([
  'P1001',
  'P1002',
  'P1008',
  'P1017',
  'P2024',
  'P2037',
]);
const TRANSACTION_API_ERROR = 'P2028';
const NO_FREE_CONNECTION = 'Unable to start a transaction';
const UNAVAILABLE_STATE = /^(08|57P0[123]$|53300$)/;
const DROPPED_CONNECTION = /^Connection terminated/;

export function isDatabaseError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name.startsWith('PrismaClient') ||
      DROPPED_CONNECTION.test(error.message))
  );
}

export function isDatabaseUnavailable(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return error instanceof Error && DROPPED_CONNECTION.test(error.message);
  }
  if (error.code === TRANSACTION_API_ERROR) {
    return error.message.includes(NO_FREE_CONNECTION);
  }
  return (
    CONNECTION_FAILURES.has(error.code) ||
    UNAVAILABLE_STATE.test(postgresStateOf(error))
  );
}

function postgresStateOf(error: Prisma.PrismaClientKnownRequestError): string {
  const adapterError = error.meta?.driverAdapterError as
    { cause?: { originalCode?: string } } | undefined;
  return adapterError?.cause?.originalCode ?? '';
}
