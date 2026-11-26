import { INVITE_PATH, type WorkspaceInviteCreated } from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";

export interface InviteOutcome {
  message: string;
  link: string | null;
}

export function inviteOutcome(
  invite: WorkspaceInviteCreated,
  translator: MessageTranslator,
): InviteOutcome {
  if (invite.delivered) {
    return {
      message: translator("outcome.sent", { email: invite.email }),
      link: null,
    };
  }
  if (invite.acceptPath !== INVITE_PATH) {
    return {
      message: translator("outcome.link", { email: invite.email }),
      link: invite.acceptPath,
    };
  }
  return {
    message: translator("outcome.failed", { email: invite.email }),
    link: null,
  };
}
