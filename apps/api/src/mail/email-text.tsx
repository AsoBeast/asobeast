import type { ReactNode } from 'react';
import { Heading, Text } from 'react-email';

export function EmailHeading({ children }: { children: ReactNode }) {
  return (
    <Heading
      as="h1"
      className="m-0 mb-[16px] text-[24px] font-semibold leading-[30px] tracking-[-0.02em] text-ink dark:text-night-ink"
    >
      {children}
    </Heading>
  );
}

export function EmailParagraph({ children }: { children: ReactNode }) {
  return (
    <Text className="m-0 mb-[16px] text-[15px] leading-[24px] text-ink dark:text-night-ink">
      {children}
    </Text>
  );
}
