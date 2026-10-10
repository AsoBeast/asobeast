import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { MailerService } from '../alerts/mailer.service';
import { PrismaService } from '../prisma/prisma.service';
import { paymentFailed } from './account-mail';
import { AccountNotifier } from './account-notifier.service';
import { billingNoticeEmail } from './billing-notice-email';

jest.mock('./billing-notice-email', () => ({
  billingNoticeEmail: jest.fn(),
}));

const render = billingNoticeEmail as jest.MockedFunction<
  typeof billingNoticeEmail
>;

describe('AccountNotifier', () => {
  const create = jest.fn();
  const send = jest.fn();

  const notifier = () =>
    new AccountNotifier(
      { enabled: true, origin: null, send } as unknown as MailerService,
      {
        user: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ email: 'owner@example.com' }),
        },
        alertDelivery: { create },
      } as unknown as PrismaService,
      {
        becauseThisWorkIsNotOwnedByOneWorkspace: (
          _why: string,
          work: () => unknown,
        ) => work(),
      } as unknown as CrossTenantAccess,
    );

  beforeEach(() => {
    create.mockReset().mockResolvedValue(undefined);
    send.mockReset().mockResolvedValue(undefined);
    render.mockReset();
  });

  it('records a notice that could not be rendered as failed instead of throwing', async () => {
    render.mockRejectedValue(new Error('template broke'));

    await expect(
      notifier().notify('ws_1', 'billing.payment_failed', paymentFailed()),
    ).resolves.toBe('failed');
    expect(send).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event: 'billing.payment_failed',
        status: 'failed',
        detail: 'template broke',
      }) as unknown,
    });
  });

  it('delivers a rendered notice to the workspace owner', async () => {
    render.mockResolvedValue({ subject: 's', text: 't', html: '<p>t</p>' });

    await expect(
      notifier().notify('ws_1', 'billing.payment_failed', paymentFailed()),
    ).resolves.toBe('delivered');
    expect(send).toHaveBeenCalledWith({
      to: 'owner@example.com',
      subject: 's',
      text: 't',
      html: '<p>t</p>',
    });
  });
});
