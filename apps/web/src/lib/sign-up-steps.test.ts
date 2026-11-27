import { describe, expect, it } from "vitest";
import { registerSteps, signUpSteps, type SignUpStep } from "./sign-up-steps";

describe("signUpSteps", () => {
  it("shows nothing to an account that owes no step", () => {
    expect(signUpSteps(undefined)).toEqual([]);
    expect(signUpSteps({ entryStep: undefined, emailVerified: true })).toEqual(
      [],
    );
  });

  it("puts an unconfirmed owner on the email step", () => {
    expect(
      signUpSteps({ entryStep: "confirm-email", emailVerified: false }),
    ).toEqual([
      { labelKey: "accountCreated", state: "done" },
      { labelKey: "emailConfirmed", state: "current" },
      { labelKey: "choosePlan", state: "upcoming" },
    ]);
  });

  it("puts a confirmed owner on the plan step", () => {
    expect(
      signUpSteps({ entryStep: "choose-plan", emailVerified: true }),
    ).toEqual([
      { labelKey: "accountCreated", state: "done" },
      { labelKey: "emailConfirmed", state: "done" },
      { labelKey: "choosePlan", state: "current" },
    ]);
  });

  it("leaves the email step out where the instance sends no confirmation mail", () => {
    expect(
      signUpSteps({ entryStep: "choose-plan", emailVerified: false }),
    ).toEqual([
      { labelKey: "accountCreated", state: "done" },
      { labelKey: "choosePlan", state: "current" },
    ]);
  });

  it("marks exactly one step current whenever there are steps", () => {
    for (const user of [
      { entryStep: "confirm-email" as const, emailVerified: false },
      { entryStep: "choose-plan" as const, emailVerified: true },
      { entryStep: "choose-plan" as const, emailVerified: false },
    ]) {
      expect(
        signUpSteps(user).filter((step) => step.state === "current"),
      ).toHaveLength(1);
    }
  });
});

describe("registerSteps", () => {
  it("puts a visitor on the account step before the email and the plan", () => {
    expect(registerSteps(true)).toEqual([
      { labelKey: "createAccount", state: "current" },
      { labelKey: "emailConfirmed", state: "upcoming" },
      { labelKey: "choosePlan", state: "upcoming" },
    ]);
  });

  it("leaves the email step out where the instance sends no confirmation mail", () => {
    expect(registerSteps(false)).toEqual([
      { labelKey: "createAccount", state: "current" },
      { labelKey: "choosePlan", state: "upcoming" },
    ]);
  });

  it("names the same later steps the confirm page names", () => {
    const later = (steps: readonly SignUpStep[]) =>
      steps.slice(1).map((step) => step.labelKey);

    expect(later(registerSteps(true))).toEqual(
      later(signUpSteps({ entryStep: "confirm-email", emailVerified: false })),
    );
    expect(later(registerSteps(false))).toEqual(
      later(signUpSteps({ entryStep: "choose-plan", emailVerified: false })),
    );
  });
});
