import { SetMetadata } from '@nestjs/common';

export const SPENDS_STORE_CAPACITY_KEY = 'spendsStoreCapacity';

export const SpendsStoreCapacity = () =>
  SetMetadata(SPENDS_STORE_CAPACITY_KEY, true);
