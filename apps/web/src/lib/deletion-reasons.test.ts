import { describe, expect, it } from "vitest";
import { DELETION_REASONS } from "@asobeast/shared";
import { translationContext } from "@/test/translation-context";
import {
  DELETION_REASON_CHOICES,
  deletionReasonChoices,
  deletionReasonLabel,
  deletionReasonOf,
} from "./deletion-reasons";

const en = translationContext("en", "workspace").translator;
const zh = translationContext("zh-CN", "workspace").translator;

describe("deletion reasons", () => {
  it("offers prefer not to say first, then every reason the api takes", () => {
    expect(DELETION_REASON_CHOICES[0]).toEqual({
      value: "unanswered",
      labelKey: "reasons.preferNotToSay",
    });
    expect(
      DELETION_REASON_CHOICES.slice(1).map((choice) => choice.value),
    ).toEqual([...DELETION_REASONS]);
  });

  it("localizes every stable reason code in English and Chinese", () => {
    expect(deletionReasonChoices(en)[0]?.label).toBe("Prefer not to say");
    expect(deletionReasonLabel("too-expensive", en)).toBe("Too expensive");
    expect(deletionReasonLabel("switched-tool", zh)).toBe("已改用其他工具");
    expect(deletionReasonChoices(zh).map((choice) => choice.label)).toEqual([
      "不愿透露",
      "价格太高",
      "缺少所需功能",
      "不再使用",
      "已改用其他工具",
      "其他",
    ]);
  });

  it("sends no reason for prefer not to say or anything unknown", () => {
    expect(deletionReasonOf("unanswered")).toBeUndefined();
    expect(deletionReasonOf("my boss")).toBeUndefined();
    expect(deletionReasonOf("not-using")).toBe("not-using");
  });
});
