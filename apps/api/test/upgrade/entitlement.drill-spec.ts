import { PrismaClient } from '@prisma/client';
import { isEntitled } from '../../src/auth/entitlement';
import { testDb } from '../helpers/test-db';

const NOW = new Date('2026-08-09T00:00:00.000Z');

describe('Entitlement against an upgraded baseline database', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = testDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('carries a baseline premium owner over to the workspace', async () => {
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: 'ws_paid' },
    });

    expect(workspace.plan).toBe('premium');
    expect(workspace.billingCustomerId).toBe('cus_drill');
    expect(isEntitled(workspace, NOW)).toBe(true);
  });

  it('leaves an unpaid baseline workspace unentitled', async () => {
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: 'ws_default' },
    });

    expect(workspace.plan).toBe('free');
    expect(isEntitled(workspace, NOW)).toBe(false);
  });
});
