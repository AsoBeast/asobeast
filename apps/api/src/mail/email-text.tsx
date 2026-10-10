import type { ReactNode } from 'react';
import { Heading, Text } from 'react-email';

export function EmailHeading({ children }: { children: ReactNode }) {
  return (
    <Heading
      as="h1"
      className="m-0 mb-[16px] text-[24px] font-semibold leading-[32px] text-ink dark:text-night-ink"
    >
      {children}
    </Heading>
  );
}

export function EmailParagraph({ children }: { children: ReactNode }) {
  return (
    <Text className="m-0 mb-[16px] text-[16px] leading-[26px] text-body dark:text-night-body">
      {children}
    </Text>
  );
}
