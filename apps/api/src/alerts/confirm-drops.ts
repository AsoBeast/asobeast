import type { AlertPayload } from '@asobeast/shared';

export type DropAudience = 'everyone' | 'confirming' | 'ordinary';

export function dropAudienceOf(payload: AlertPayload): DropAudience {
  switch (payload.event) {
    case 'rank.dropped':
      return payload.confirmed === true ? 'confirming' : 'ordinary';
    case 'rank.milestone':
      if (payload.confirmed === true) return 'confirming';
      return payload.direction === 'left' || payload.undoesDrop === true
        ? 'ordinary'
        : 'everyone';
    case 'rank.improved':
      return payload.undoesDrop === true ? 'ordinary' : 'everyone';
    default:
      return 'everyone';
  }
}

export function reachesChannel(
  payload: AlertPayload,
  confirmDrops: boolean,
): boolean {
  const audience = dropAudienceOf(payload);
  return (
    audience === 'everyone' || (audience === 'confirming') === confirmDrops
  );
}

export function confirmDropsWhere(payload: AlertPayload): {
  confirmDrops?: boolean;
} {
  const audience = dropAudienceOf(payload);
  return audience === 'everyone'
    ? {}
    : { confirmDrops: audience === 'confirming' };
}
