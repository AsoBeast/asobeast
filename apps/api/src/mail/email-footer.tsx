import type { ReactNode } from 'react';
import { Link, Text } from 'react-email';

export function FooterLine({ children }: { children: ReactNode }) {
  return (
    <Text className="m-0 mb-[8px] text-[12px] leading-[18px] text-muted dark:text-night-muted">
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
    <Link href={href} className="text-muted underline dark:text-night-muted">
      {children}
    </Link>
  );
}
