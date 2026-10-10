import { generateKeyPairSync } from 'node:crypto';
import { dkimVerify } from 'mailauth/lib/dkim/verify';
import { createTransport } from 'nodemailer';
import { DKIM_SIGNED_HEADERS, outgoingMessage } from './outgoing-message';

const DOMAIN = 'mail.example.com';
const SELECTOR = 'asobeast';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

const resolver = (name: string): Promise<string[][]> =>
  name === `${SELECTOR}._domainkey.${DOMAIN}`
    ? Promise.resolve([
        [
          `v=DKIM1; k=rsa; p=${publicKey.export({ type: 'spki', format: 'der' }).toString('base64')}`,
        ],
      ])
    : Promise.reject(Object.assign(new Error(name), { code: 'ENOTFOUND' }));

const signedMessage = async (): Promise<Buffer> => {
  const info = await createTransport({
    streamTransport: true,
    buffer: true,
    dkim: {
      domainName: DOMAIN,
      keySelector: SELECTOR,
      privateKey: privateKey
        .export({ type: 'pkcs8', format: 'pem' })
        .toString(),
      headerFieldNames: DKIM_SIGNED_HEADERS,
    },
  }).sendMail(
    outgoingMessage(`AsoBeast <alerts@${DOMAIN}>`, {
      to: 'ada@example.com',
      subject: '[asobeast] Daily app update',
      text: 'One change',
      html: '<p>One change</p>',
      headers: {
        'List-Unsubscribe': `<https://aso.example.com/api/backend/email-alerts/ea_1/unsubscribe?token=t>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  );
  return Buffer.isBuffer(info.message) ? info.message : Buffer.alloc(0);
};

describe('dkim signature', () => {
  it('verifies and covers both one click unsubscribe headers', async () => {
    const { results } = await dkimVerify(await signedMessage(), { resolver });
    const [signature] = results;

    expect(signature.status.result).toBe('pass');
    expect(signature.signingDomain).toBe(DOMAIN);
    expect(signature.signingHeaders?.keys.split(': ')).toEqual(
      expect.arrayContaining(['List-Unsubscribe', 'List-Unsubscribe-Post']),
    );
  });
});
