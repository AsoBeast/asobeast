import type { User } from '@prisma/client';
import type { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { REDACTED } from '../common/logging/log-redaction';
import type { PrismaService } from '../prisma/prisma.service';
import { SupportAudit } from './support-audit.service';

const ACTOR = { id: 'user_operator', email: 'operator@example.com' } as User;

interface AccessUpdate {
  where: { id: string };
  data: { outcome: string; detail: string | null };
}

function auditOverFakes() {
  const create = jest.fn().mockResolvedValue({ id: 'access_1' });
  const update = jest
    .fn<Promise<object>, [AccessUpdate]>()
    .mockResolvedValue({});
  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: jest.fn(
      (_justification: string, work: () => Promise<unknown>) => work(),
    ),
  };
  const audit = new SupportAudit(
    { supportAccess: { create, update } } as unknown as PrismaService,
    crossTenant as unknown as CrossTenantAccess,
  );
  return { audit, update };
}

describe('SupportAudit', () => {
  it('stores a failed action without the secrets its error carried', async () => {
    const { audit, update } = auditOverFakes();
    const failure = new Error(
      'Stripe refused sk_live_abcdefgh12345678 at postgresql://asobeast:hunter2secret@db:5432/asobeast',
    );

    await expect(
      audit.attempt({
        actor: ACTOR,
        workspaceId: 'ws_customer',
        action: 'reconcile',
        reason: 'checking the subscription',
        work: () => Promise.reject(failure),
      }),
    ).rejects.toBe(failure);

    const [{ data }] = update.mock.calls[0];
    expect(data.outcome).toBe('failed');
    expect(data.detail).toContain(REDACTED);
    expect(data.detail).not.toContain('sk_live_abcdefgh12345678');
    expect(data.detail).not.toContain('hunter2secret');
  });
});
