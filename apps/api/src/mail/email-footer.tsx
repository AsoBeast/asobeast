import type { ReactNode } from 'react';
import { Link, Text } from 'react-email';

export function FooterLine({ children }: { children: ReactNode }) {
  return (
    <Text className="m-0 mb-[8px] text-[12px] leading-[18px] text-ink-3 dark:text-night-ink-3">
      {children}
    </Text>
  );
}

export function FooterLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="text-ink-3 underline dark:text-night-ink-3">
      {children}
    </Link>
  );
}
