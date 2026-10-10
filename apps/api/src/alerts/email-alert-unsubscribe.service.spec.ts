import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import {
  EmailAlertUnsubscribe,
  oneClickHeaders,
} from './email-alert-unsubscribe.service';
import { MailerService } from './mailer.service';
import { unsubscribeToken } from './unsubscribe-token';

const SECRET = 's'.repeat(32);
const findUnique = jest.fn();
const OPS = { alertId: 'ea_1', email: 'ops@example.com' };

const build = (origin: string | null) => {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  findUnique.mockReset().mockResolvedValue({ email: OPS.email });
  const config = {
    get: jest.fn(() => SECRET),
  } as unknown as ConfigService<Env, true>;
  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: jest.fn(
      (_why: string, work: () => unknown) => work(),
    ),
  } as unknown as CrossTenantAccess;
  const service = new EmailAlertUnsubscribe(
    config,
    { origin } as MailerService,
    { emailAlert: { updateMany, findUnique } } as unknown as PrismaService,
    crossTenant,
  );
  return { service, updateMany };
};

describe('EmailAlertUnsubscribe', () => {
  it('mints no links without a web origin', () => {
    expect(build(null).service.links(OPS)).toBeNull();
  });

  it('links the confirmation page and the one click endpoint with one token', () => {
    const token = unsubscribeToken(SECRET, OPS);
    expect(build('https://aso.example.com').service.links(OPS)).toEqual({
      page: `https://aso.example.com/unsubscribe?alert=ea_1&token=${token}`,
      oneClick: `https://aso.example.com/api/backend/email-alerts/ea_1/unsubscribe?token=${token}`,
    });
  });

  it('refuses another alert token without pausing anything', async () => {
    const { service, updateMany } = build('https://aso.example.com');
    await expect(
      service.unsubscribe(
        'ea_1',
        unsubscribeToken(SECRET, { ...OPS, alertId: 'ea_2' }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('answers not found for an alert that does not exist', async () => {
    const { service, updateMany } = build('https://aso.example.com');
    findUnique.mockResolvedValue(null);
    await expect(
      service.unsubscribe('ea_1', unsubscribeToken(SECRET, OPS)),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('refuses a link sent to an address the alert no longer uses', async () => {
    const { service, updateMany } = build('https://aso.example.com');
    findUnique.mockResolvedValue({ email: 'new@example.com' });
    await expect(
      service.unsubscribe('ea_1', unsubscribeToken(SECRET, OPS)),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('pauses only the alert the token names, at the address it was checked against', async () => {
    const { service, updateMany } = build('https://aso.example.com');
    await service.unsubscribe('ea_1', unsubscribeToken(SECRET, OPS));
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'ea_1', email: OPS.email },
      data: { active: false },
    });
  });
});

describe('oneClickHeaders', () => {
  const links = (origin: string) => ({
    page: `${origin}/unsubscribe?alert=ea_1&token=t`,
    oneClick: `${origin}/api/backend/email-alerts/ea_1/unsubscribe?token=t`,
  });

  it('offers one click unsubscribe over https', () => {
    expect(oneClickHeaders(links('https://aso.example.com'))).toEqual({
      'List-Unsubscribe':
        '<https://aso.example.com/api/backend/email-alerts/ea_1/unsubscribe?token=t>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('offers nothing over plain http or without links', () => {
    expect(oneClickHeaders(links('http://localhost:3000'))).toEqual({});
    expect(oneClickHeaders(null)).toEqual({});
  });
});
