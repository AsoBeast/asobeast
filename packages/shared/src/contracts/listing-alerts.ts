import type { AlertAppIdentity } from './changes';

export interface RatingDroppedPayload {
  event: 'rating.dropped';
  occurredAt: string;
  app: { id: string; name: string | null } & AlertAppIdentity;
  country: string;
  from: number;
  to: number;
  fromCount: number;
  toCount: number;
  fromDate: string;
  toDate: string;
  dropTenths: number;
  version: string | null;
  actionId: string | null;
}
