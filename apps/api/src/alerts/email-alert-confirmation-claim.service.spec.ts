import { GoneException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { CONFIRMATION_DAYS, confirmationToken } from './confirmation-token';
import { EmailAlertConfirmationClaim } from './email-alert-confirmation-claim.service';

const SECRET = 's'.repeat(32);
const DAY_MS = 24 * 60 * 60 * 1000;

const build = () => {
  const findUnique = jest.fn();
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: jest.fn(
      (_why: string, work: () => unknown) => work(),
    ),
  } as unknown as CrossTenantAccess;
  const service = new EmailAlertConfirmationClaim(
    { get: jest.fn(() => SECRET) } as unknown as ConfigService<Env, true>,
    { emailAlert: { findUnique, updateMany } } as unknown as PrismaService,
    crossTenant,
  );
  return { service, findUnique, updateMany };
};

const sentAt = (ageDays: number) => new Date(Date.now() - ageDays * DAY_MS);

const stored = (overrides: object = {}) => ({
  email: 'ops@example.com',
  confirmedAt: null,
  confirmationSentAt: sentAt(1),
  ...overrides,
});

const tokenFor = (at: Date, email = 'ops@example.com') =>
  confirmationToken(SECRET, { alertId: 'ea_1', email, sentAt: at });

describe('EmailAlertConfirmationClaim', () => {
  it('confirms the recipient the token was minted for', async () => {
    const { service, findUnique, updateMany } = build();
    const at = sentAt(1);
    findUnique.mockResolvedValue(stored({ confirmationSentAt: at }));

    await service.confirm('ea_1', tokenFor(at));

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'ea_1',
        email: 'ops@example.com',
        confirmationSentAt: at,
        confirmedAt: null,
      },
      data: { confirmedAt: expect.any(Date) as Date },
    });
  });

  it('answers not found for an unknown alert, a withdrawn link or a foreign token', async () => {
    const { service, findUnique, updateMany } = build();
    const at = sentAt(1);

    findUnique.mockResolvedValue(null);
    await expect(service.confirm('ea_1', tokenFor(at))).rejects.toBeInstanceOf(
      NotFoundException,
    );

    findUnique.mockResolvedValue(stored({ confirmationSentAt: null }));
    await expect(service.confirm('ea_1', tokenFor(at))).rejects.toBeInstanceOf(
      NotFoundException,
    );

    findUnique.mockResolvedValue(stored({ confirmationSentAt: at }));
    await expect(
      service.confirm('ea_1', tokenFor(at, 'other@example.com')),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.confirm('ea_1', tokenFor(sentAt(2))),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(updateMany).not.toHaveBeenCalled();
  });

  it('answers gone once the link is older than its lifetime', async () => {
    const { service, findUnique, updateMany } = build();
    const at = sentAt(CONFIRMATION_DAYS + 1);
    findUnique.mockResolvedValue(stored({ confirmationSentAt: at }));

    await expect(service.confirm('ea_1', tokenFor(at))).rejects.toBeInstanceOf(
      GoneException,
    );
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('accepts the same link again once confirmed, even after it expired', async () => {
    const { service, findUnique, updateMany } = build();
    const at = sentAt(CONFIRMATION_DAYS + 1);
    findUnique.mockResolvedValue(
      stored({ confirmationSentAt: at, confirmedAt: new Date() }),
    );

    await expect(
      service.confirm('ea_1', tokenFor(at)),
    ).resolves.toBeUndefined();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
