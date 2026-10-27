import { describe, expect, it } from "vitest";
import type { AuthStatus, AuthUser } from "@asobeast/shared";
import { authStateOf } from "./auth-state";

const STATUS: AuthStatus = {
  billing: true,
  registrationOpen: true,
  setupRequired: false,
  authenticated: true,
};

const userOf = (over: Partial<AuthUser> = {}): AuthUser => ({
  id: "u1",
  email: "owner@example.com",
  emailVerified: false,
  name: null,
  role: "owner",
  plan: "free",
  trialEndsAt: null,
  planExpiresAt: null,
  entitled: false,
  platformOperator: false,
  ...over,
});

describe("authStateOf", () => {
  it("names the step the account still owes", () => {
    expect(
      authStateOf(STATUS, userOf({ entryStep: "choose-plan" })).entryStep,
    ).toBe("choose-plan");
    expect(authStateOf(STATUS, userOf()).entryStep).toBeUndefined();
  });

  it("names no step for a signed out viewer", () => {
    expect(
      authStateOf(
        { ...STATUS, authenticated: false },
        userOf({ entryStep: "confirm-email" }),
      ).entryStep,
    ).toBeUndefined();
  });

  it("knows a stripe trial and counts it as a trial", () => {
    expect(
      authStateOf(
        STATUS,
        userOf({ plan: "indie", entitled: true, trialing: true }),
      ),
    ).toMatchObject({
      trialing: true,
      trialOnly: true,
    });
  });

  it("keeps a legacy trial a trial", () => {
    expect(
      authStateOf(
        STATUS,
        userOf({
          entitled: true,
          trialEndsAt: "2026-10-30T00:00:00.000Z",
        }),
      ),
    ).toMatchObject({ trialOnly: true, trialing: false });
  });

  it("reads the role", () => {
    expect(authStateOf(STATUS, userOf({ role: "member" }))).toMatchObject({
      isMember: true,
      isOwner: false,
    });
  });

  it("reads nothing for a signed out visitor", () => {
    expect(
      authStateOf({ ...STATUS, authenticated: false }, userOf()),
    ).toMatchObject({
      user: undefined,
      isMember: false,
    });
  });
});
