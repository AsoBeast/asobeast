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

  it("sends an operator who may start the trial to the trial", () => {
    expect(
      adminAccessOf({
        ...OPERATOR,
        entitled: false,
        trialAwaitsConfirmation: true,
        trialAwaitsCheckout: true,
      }),
    ).toBe("awaits-checkout");
  });

  it("needs a plan for an operator who is not offered the trial, confirmed or not", () => {
    expect(
      adminAccessOf({
        ...OPERATOR,
        entitled: false,
        trialAwaitsConfirmation: true,
        trialAwaitsCheckout: false,
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
