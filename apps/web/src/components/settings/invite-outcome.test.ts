import { describe, expect, it } from "vitest";
import type { WorkspaceInviteCreated } from "@asobeast/shared";
import { inviteOutcome } from "./invite-outcome";

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
    expect(inviteOutcome(invite({ delivered: true }))).toEqual({
      message: "Invitation sent to teammate@example.com.",
      link: null,
    });
  });

  it("hands the owner the link when the API returned one", () => {
    expect(
      inviteOutcome(invite({ acceptPath: "/invite?token=abc123" })),
    ).toEqual({
      message:
        "The invitation could not be emailed, so send teammate@example.com this link yourself.",
      link: "/invite?token=abc123",
    });
  });

  it("asks the owner to invite again when there is no link to hand over", () => {
    expect(inviteOutcome(invite({}))).toEqual({
      message:
        "The invitation to teammate@example.com could not be emailed. Check the email settings, then invite them again.",
      link: null,
    });
  });
});
