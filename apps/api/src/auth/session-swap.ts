import { ConflictException } from '@nestjs/common';
import type { User } from '@prisma/client';

export function refuseSessionSwap(
  signedIn: User | null,
  claiming: Pick<User, 'id'> | null,
): void {
  if (!signedIn) return;
  if (claiming && signedIn.id === claiming.id) return;
  throw new ConflictException(
    'Sign out of the current account before opening this link',
  );
}
