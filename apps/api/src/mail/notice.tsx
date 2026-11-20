import type { ReactNode } from 'react';
import { Text } from 'react-email';

export function Notice({ children }: { children: ReactNode }) {
  return (
    <Text className="my-[16px] rounded-[8px] bg-well px-[16px] py-[12px] text-[13px] leading-[20px] text-ink-2 dark:bg-night-well dark:text-night-ink-2">
      {children}
    </Text>
  );
}
