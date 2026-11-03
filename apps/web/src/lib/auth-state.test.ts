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
  it("sends an account that may start the trial to checkout", () => {
    expect(
      authStateOf(STATUS, userOf({ trialAwaitsCheckout: true })),
    ).toMatchObject({ awaitingCheckout: true, trialing: false });
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
      awaitingCheckout: false,
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

  it("reads the confirmation and the role", () => {
    expect(
      authStateOf(
        STATUS,
        userOf({ trialAwaitsConfirmation: true, role: "member" }),
      ),
    ).toMatchObject({
      awaitingConfirmation: true,
      isMember: true,
      isOwner: false,
    });
  });

  it("reads nothing for a signed out visitor", () => {
    expect(
      authStateOf({ ...STATUS, authenticated: false }, userOf()),
    ).toMatchObject({
      user: undefined,
      awaitingCheckout: false,
      awaitingConfirmation: false,
      isMember: false,
    });
  });
});
