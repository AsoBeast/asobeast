import type { ReactElement } from 'react';
import { render, toPlainText } from 'react-email';

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

export async function renderEmail(
  subject: string,
  email: ReactElement,
  text?: string,
): Promise<EmailContent> {
  const html = await render(email);
  return { subject, html, text: text ?? toPlainText(html) };
}
