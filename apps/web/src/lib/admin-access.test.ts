import { describe, expect, it } from "vitest";
import { adminAccessOf } from "./admin-access";

const OPERATOR = { platformOperator: true, entitled: true };

describe("adminAccessOf", () => {
  it("is granted to an operator whose workspace has a plan in force", () => {
    expect(adminAccessOf(OPERATOR)).toBe("granted");
  });

  it("is granted on an instance that does not meter plans", () => {
    expect(adminAccessOf({ ...OPERATOR, trialAwaitsConfirmation: false })).toBe(
      "granted",
    );
  });

  it("needs a plan for an operator whose workspace has none", () => {
    expect(adminAccessOf({ ...OPERATOR, entitled: false })).toBe("needs-plan");
  });

  it("asks an operator who has not confirmed their email to confirm it", () => {
    expect(
      adminAccessOf({
        ...OPERATOR,
        entitled: false,
        trialAwaitsConfirmation: true,
      }),
    ).toBe("awaits-confirmation");
  });

  it("does not ask a confirmed operator whose trial ended to confirm anything", () => {
    expect(
      adminAccessOf({
        ...OPERATOR,
        entitled: false,
        trialAwaitsConfirmation: false,
      }),
    ).toBe("needs-plan");
  });

  it("is denied to anyone who is not the platform operator", () => {
    expect(adminAccessOf({ platformOperator: false, entitled: true })).toBe(
      "denied",
    );
    expect(adminAccessOf({ platformOperator: false, entitled: false })).toBe(
      "denied",
    );
  });

  it("is denied when there is no signed in viewer", () => {
    expect(adminAccessOf(null)).toBe("denied");
  });
});
