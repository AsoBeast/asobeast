import { INVITE_PATH } from '@asobeast/shared';

export interface InviteDelivery {
  delivered: boolean;
  canEmail: boolean;
  registrationOpen: boolean;
}

export function acceptPathFor(token: string, delivery: InviteDelivery): string {
  const inviterMayHoldTheLink =
    !delivery.delivered && !(delivery.canEmail && delivery.registrationOpen);
  return inviterMayHoldTheLink ? `${INVITE_PATH}?token=${token}` : INVITE_PATH;
}
