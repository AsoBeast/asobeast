import { GoneException, Logger, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { PrismaService } from '../prisma/prisma.service';
import { sha256 } from './password-hash';
import {
  PasswordResetService,
  RECOVERY_UNAVAILABLE,
  RESET_TOKEN_MINUTES,
} from './password-reset.service';
import { RecoveryRateLimiter } from './rate-limit/recovery-rate.limiter';
import { RecoveryMailer } from './recovery-mailer';

const NOW = new Date('2026-08-20T10:00:00.000Z');

const ACCOUNT = { id: 'usr_1', email: 'owner@example.com' };

describe('PasswordResetService', () => {
  const findUnique = jest.fn();
  const update = jest.fn<
    Promise<unknown>,
    [{ where: unknown; data: Record<string, unknown> }]
  >();
  const updateMany = jest.fn<
    Promise<{ count: number }>,
    [{ where: Record<string, unknown>; data: Record<string, unknown> }]
  >();
  const send = jest.fn<Promise<void>, [string, string]>();
  const claim = jest.fn<Promise<boolean>, [string, Date]>();

  const prisma = {
    user: { findUnique, update, updateMany },
  } as unknown as PrismaService;
  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: (
      _justification: string,
      work: () => Promise<unknown>,
    ) => work(),
  } as unknown as CrossTenantAccess;
  const limiter = { claim } as unknown as RecoveryRateLimiter;

  const build = (configured = true): PasswordResetService =>
    new PasswordResetService(
      prisma,
      crossTenant,
      { send, configured } as unknown as RecoveryMailer,
      limiter,
    );

  const tokenSent = (): string => send.mock.calls[0][1];

  const settle = (): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    findUnique.mockReset().mockResolvedValue(ACCOUNT);
    update.mockReset().mockResolvedValue(ACCOUNT);
    updateMany.mockReset().mockResolvedValue({ count: 1 });
    send.mockReset().mockResolvedValue(undefined);
    claim.mockReset().mockResolvedValue(true);
  });

  it('refuses to accept a request when recovery is not fully configured', async () => {
    await expect(build(false).request(ACCOUNT.email, NOW)).rejects.toThrow(
      RECOVERY_UNAVAILABLE,
    );
  });

  it('emails a token to the address that owns the account', async () => {
    await build().request('  Owner@Example.com ', NOW);

    expect(findUnique).toHaveBeenCalledWith({
      where: { email: ACCOUNT.email },
      select: { id: true, email: true },
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe(ACCOUNT.email);
    expect(tokenSent()).toHaveLength(48);
  });

  it('stores only a hash of the token, alongside its expiry', async () => {
    await build().request(ACCOUNT.email, NOW);

    expect(update).toHaveBeenCalledWith({
      where: { id: ACCOUNT.id },
      data: {
        resetHash: sha256(tokenSent()),
        resetExpiresAt: new Date(NOW.getTime() + RESET_TOKEN_MINUTES * 60_000),
      },
    });
  });

  it('mints a different token every time', async () => {
    const service = build();
    await service.request(ACCOUNT.email, NOW);
    await service.request(ACCOUNT.email, NOW);

    expect(send.mock.calls[0][1]).not.toBe(send.mock.calls[1][1]);
  });

  it('does nothing at all for an address with no account', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      build().request('stranger@example.com', NOW),
    ).resolves.toBeUndefined();
    expect(update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('stops minting once the account has spent its hourly allowance', async () => {
    claim.mockResolvedValue(false);

    await build().request(ACCOUNT.email, NOW);

    expect(findUnique).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps the token usable when the email could not be delivered', async () => {
    send.mockRejectedValue(new Error('smtp is unreachable'));

    await expect(build().request(ACCOUNT.email, NOW)).resolves.toBeUndefined();
    await settle();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('answers the request without waiting for the relay to take the message', async () => {
    let release = (): void => undefined;
    send.mockImplementation(
      () => new Promise<void>((resolve) => (release = resolve)),
    );

    await expect(build().request(ACCOUNT.email, NOW)).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(1);
    release();
  });

  it('refuses a token it never issued', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      build().redeem('a'.repeat(48), 'newpassword1', NOW),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuses a token past its expiry', async () => {
    findUnique.mockResolvedValue({
      id: ACCOUNT.id,
      resetExpiresAt: new Date(NOW.getTime() - 1),
    });

    await expect(
      build().redeem('a'.repeat(48), 'newpassword1', NOW),
    ).rejects.toThrow(GoneException);
  });

  it('refuses a token at the moment it expires', async () => {
    findUnique.mockResolvedValue({ id: ACCOUNT.id, resetExpiresAt: NOW });

    await expect(
      build().redeem('a'.repeat(48), 'newpassword1', NOW),
    ).rejects.toThrow(GoneException);
  });

  it('spends the token, rehashes the password and ends every other session', async () => {
    findUnique.mockResolvedValue({
      id: ACCOUNT.id,
      resetExpiresAt: new Date(NOW.getTime() + 1),
    });

    await build().redeem('a'.repeat(48), 'newpassword1', NOW);

    const data = updateMany.mock.calls[0][0].data;
    expect(data.sessionVersion).toEqual({ increment: 1 });
    expect(data.resetHash).toBeNull();
    expect(data.resetExpiresAt).toBeNull();
    await expect(
      argon2.verify(data.passwordHash, 'newpassword1'),
    ).resolves.toBe(true);
  });

  it('claims the token by hash and expiry in the write that spends it', async () => {
    findUnique.mockResolvedValue({
      id: ACCOUNT.id,
      resetExpiresAt: new Date(NOW.getTime() + 1),
    });

    await build().redeem('token-value', 'newpassword1', NOW);

    expect(updateMany.mock.calls[0][0].where).toEqual({
      resetHash: sha256('token-value'),
      resetExpiresAt: { gt: NOW },
    });
  });

  it('refuses a token another request spent between the read and the write', async () => {
    findUnique.mockResolvedValue({
      id: ACCOUNT.id,
      resetExpiresAt: new Date(NOW.getTime() + 1),
    });
    updateMany.mockResolvedValue({ count: 0 });

    await expect(
      build().redeem('a'.repeat(48), 'newpassword1', NOW),
    ).rejects.toThrow(NotFoundException);
  });

  it('hashes the replacement password before it claims the token', async () => {
    findUnique.mockResolvedValue({
      id: ACCOUNT.id,
      resetExpiresAt: new Date(NOW.getTime() + 1),
    });

    await build().redeem('a'.repeat(48), 'newpassword1', NOW);

    expect(typeof updateMany.mock.calls[0][0].data.passwordHash).toBe('string');
    expect(update).not.toHaveBeenCalled();
  });

  it('leaves a record that the password was reset, without the token in it', async () => {
    const recorded = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    findUnique.mockResolvedValue({
      id: ACCOUNT.id,
      resetExpiresAt: new Date(NOW.getTime() + 1),
    });

    await build().redeem('token-value', 'newpassword1', NOW);

    const line = recorded.mock.calls.flat().join(' ');
    expect(line).toContain(ACCOUNT.id);
    expect(line).not.toContain('token-value');
    recorded.mockRestore();
  });

  it('looks the token up by its hash, never by its plaintext', async () => {
    findUnique.mockResolvedValue({
      id: ACCOUNT.id,
      resetExpiresAt: new Date(NOW.getTime() + 1),
    });

    await build().redeem('token-value', 'newpassword1', NOW);

    expect(findUnique).toHaveBeenCalledWith({
      where: { resetHash: sha256('token-value') },
      select: { id: true, resetExpiresAt: true },
    });
  });
});
