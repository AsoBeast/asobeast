import { describe, expect, it } from "vitest";
import { seg, toolByName } from "./index";

describe("seg", () => {
  it.each([".", "..", ""])(
    "refuses %j, which a url would fold into the segment before it",
    (value) => {
      expect(() => seg(value)).toThrow("is not an id");
    },
  );

  it.each([
    ["cmg1q2w3e0000abcd1234efgh", "cmg1q2w3e0000abcd1234efgh"],
    ["app.v2", "app.v2"],
    ["...", "..."],
    ["../jobs", "..%2Fjobs"],
    ["kw/1?x=y", "kw%2F1%3Fx%3Dy"],
  ])("keeps %j inside one segment as %j", (value, encoded) => {
    expect(seg(value)).toBe(encoded);
  });

  it("refuses a read tool whose id would climb to the route above it", () => {
    expect(() => toolByName("get_app")!.request({ appId: ".." })).toThrow(
      "is not an id",
    );
  });
});
