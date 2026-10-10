import type { ReactNode } from 'react';
import { PRODUCT_NAME } from '@asobeast/shared';
import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from 'react-email';
import { hostOf, logoUrl } from './email-links';
import { EMAIL_TAILWIND } from './email-theme';

interface EmailLayoutProps {
  preview: string;
  origin: string | null;
  footer: ReactNode;
  children: ReactNode;
}

export function EmailLayout({
  preview,
  origin,
  footer,
  children,
}: EmailLayoutProps) {
  const host = hostOf(origin);
  return (
    <Html lang="en" dir="ltr">
      <Tailwind config={EMAIL_TAILWIND}>
        <Head>
          <meta name="color-scheme" content="light dark" />
          <meta name="supported-color-schemes" content="light dark" />
        </Head>
        <Body className="m-0 bg-canvas font-sans dark:bg-night-canvas">
          <Preview>{preview}</Preview>
          <Section className="bg-canvas dark:bg-night-canvas">
            <Container className="mx-auto w-full max-w-[600px] px-[16px] py-[32px]">
              <EmailHeader origin={origin} />
              <Section className="rounded-[12px] border border-solid border-line bg-surface p-[32px] max-sm:p-[20px] dark:border-night-line dark:bg-night-surface">
                {children}
              </Section>
              <Section className="px-[8px] pt-[24px] text-center">
                {footer}
                {host && (
                  <Text className="m-0 mt-[8px] text-[12px] leading-[18px] text-muted dark:text-night-muted">
                    {`Sent by ${PRODUCT_NAME} at ${host}`}
                  </Text>
                )}
              </Section>
            </Container>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
}

function EmailHeader({ origin }: { origin: string | null }) {
  const logo = logoUrl(origin);
  return (
    <Section className="pb-[24px]">
      <Row>
        {logo && (
          <Column className="w-[60px]">
            <Img
              src={logo}
              alt=""
              width={48}
              height={48}
              className="rounded-[10px]"
            />
          </Column>
        )}
        <Column>
          <Text className="m-0 text-[20px] font-semibold leading-[28px] text-ink dark:text-night-ink">
            {PRODUCT_NAME}
          </Text>
        </Column>
      </Row>
    </Section>
  );
}
