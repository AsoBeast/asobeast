import { createTransport } from 'nodemailer';
import { outgoingMessage } from './outgoing-message';

const raw = async (
  headers?: Readonly<Record<string, string>>,
): Promise<string> => {
  const info = await createTransport({
    streamTransport: true,
    buffer: true,
  }).sendMail(
    outgoingMessage('AsoBeast <alerts@mail.example.com>', {
      to: 'ada@example.com',
      subject: 'Reset your asobeast password',
      text: 'Choose a new password https://aso.example.com/reset-password?token=abc',
      html: '<p>Choose a new password</p>',
      headers,
    }),
  );
  return Buffer.isBuffer(info.message) ? info.message.toString() : '';
};

const headerBlock = (message: string): string => message.split(/\r?\n\r?\n/)[0];

describe('outgoingMessage', () => {
  it('marks the message as automated mail', async () => {
    const headers = headerBlock(await raw());
    expect(headers).toContain('Auto-Submitted: auto-generated');
    expect(headers).toContain('X-Auto-Response-Suppress: All');
  });

  it('identifies the message on the sender domain', async () => {
    expect(headerBlock(await raw())).toMatch(
      /Message-ID: <[^>]+@mail\.example\.com>/,
    );
  });

  it('sends a text and an html alternative', async () => {
    const message = await raw();
    expect(headerBlock(message)).toContain(
      'Content-Type: multipart/alternative',
    );
    expect(message).toContain('Content-Type: text/plain');
    expect(message).toContain('Content-Type: text/html');
  });

  it('adds caller headers but never drops the automated mail marker', async () => {
    const headers = headerBlock(
      await raw({
        'List-Unsubscribe': '<https://aso.example.com/api/backend/x>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'Auto-Submitted': 'no',
      }),
    );
    expect(headers).toContain(
      'List-Unsubscribe: <https://aso.example.com/api/backend/x>',
    );
    expect(headers).toContain(
      'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
    );
    expect(headers).toContain('Auto-Submitted: auto-generated');
    expect(headers).not.toContain('Auto-Submitted: no');
  });
});
