import { INVITE_PATH, type WorkspaceInviteCreated } from "@asobeast/shared";

export interface InviteOutcome {
  message: string;
  link: string | null;
}

export function inviteOutcome(invite: WorkspaceInviteCreated): InviteOutcome {
  if (invite.delivered) {
    return { message: `Invitation sent to ${invite.email}.`, link: null };
  }
  if (invite.acceptPath !== INVITE_PATH) {
    return {
      message: `The invitation could not be emailed, so send ${invite.email} this link yourself.`,
      link: invite.acceptPath,
    };
  }
  return {
    message: `The invitation to ${invite.email} could not be emailed. Check the email settings, then invite them again.`,
    link: null,
  };
}
