import { describe, expect, it } from "vitest";
import type { WorkspaceInviteCreated } from "@asobeast/shared";
import { translationContext } from "@/test/translation-context";
import { inviteOutcome } from "./invite-outcome";

const en = translationContext("en", "team").translator;
const zh = translationContext("zh-CN", "team").translator;

const invite = (
  overrides: Partial<WorkspaceInviteCreated>,
): WorkspaceInviteCreated => ({
  id: "inv1",
  email: "teammate@example.com",
  role: "member",
  expiresAt: "2026-10-18T00:00:00.000Z",
  createdAt: "2026-10-11T00:00:00.000Z",
  acceptPath: "/invite",
  delivered: false,
  ...overrides,
});

describe("inviteOutcome", () => {
  it("shows no link once the email was sent", () => {
    expect(inviteOutcome(invite({ delivered: true }), en)).toEqual({
      message: "Invitation sent to teammate@example.com.",
      link: null,
    });
  });

  it("hands the owner the link when the API returned one", () => {
    expect(
      inviteOutcome(invite({ acceptPath: "/invite?token=abc123" }), en),
    ).toEqual({
      message:
        "The invitation could not be emailed, so send teammate@example.com this link yourself.",
      link: "/invite?token=abc123",
    });
  });

  it("asks the owner to invite again when there is no link to hand over", () => {
    expect(inviteOutcome(invite({}), en)).toEqual({
      message:
        "The invitation to teammate@example.com could not be emailed. Check the email settings, then invite them again.",
      link: null,
    });
  });

  it("localizes each outcome in Chinese without changing the address", () => {
    expect(inviteOutcome(invite({ delivered: true }), zh)).toEqual({
      message: "邀请已发送至 teammate@example.com。",
      link: null,
    });
    expect(
      inviteOutcome(invite({ acceptPath: "/invite?token=abc123" }), zh),
    ).toEqual({
      message: "邀请邮件未能发送，请手动将此链接发给 teammate@example.com。",
      link: "/invite?token=abc123",
    });
    expect(inviteOutcome(invite({}), zh)).toEqual({
      message:
        "未能通过邮件发送给 teammate@example.com 的邀请。请检查邮件设置，然后重新邀请。",
      link: null,
    });
  });
});
