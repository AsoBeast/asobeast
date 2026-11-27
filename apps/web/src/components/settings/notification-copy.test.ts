import { describe, expect, it } from "vitest";
import type { AlertFlushResult } from "@asobeast/shared";
import { flushMessage } from "@/components/settings/DeliveryCard";
import { deliveryStatusLabel } from "@/components/settings/DeliveriesSection";
import {
  ratingDropOption,
  reviewStarOption,
} from "@/components/settings/alert-events";
import { translationContext } from "@/test/translation-context";

const en = translationContext("en", "notifications").translator;
const zh = translationContext("zh-CN", "notifications").translator;

const flush = (
  overrides: Partial<AlertFlushResult> = {},
): AlertFlushResult => ({
  flushed: 2,
  channels: 1,
  notifications: 3,
  ...overrides,
});

describe("notification copy", () => {
  it("uses ICU plurals for a flush result", () => {
    expect(flushMessage(flush(), en)).toBe(
      "Sent 3 notifications to 1 channel from 2 events",
    );
    expect(
      flushMessage(flush({ flushed: 1, channels: 2, notifications: 1 }), en),
    ).toBe("Sent 1 notification to 2 channels from 1 event");
    expect(
      flushMessage(flush({ flushed: 0, channels: 0, notifications: 0 }), en),
    ).toBe("Nothing to flush");
  });

  it("localizes flush counts in Chinese", () => {
    expect(flushMessage(flush(), zh)).toBe(
      "已从 2 个事件向 1 个渠道发送 3 条通知",
    );
  });

  it("localizes delivery status by stable status code", () => {
    expect(deliveryStatusLabel(true, en)).toBe("Success");
    expect(deliveryStatusLabel(false, en)).toBe("Failed");
    expect(deliveryStatusLabel(true, zh)).toBe("成功");
    expect(deliveryStatusLabel(false, zh)).toBe("失败");
  });

  it("localizes star choices and rating thresholds", () => {
    expect(reviewStarOption(1, en)).toBe("1 star");
    expect(reviewStarOption(2, en)).toBe("2 stars");
    expect(reviewStarOption(1, zh)).toBe("1 星");
    expect(reviewStarOption(2, zh)).toBe("2 星");
    expect(ratingDropOption(1, en)).toBe("0.1 star");
    expect(ratingDropOption(2, en)).toBe("0.2 stars");
    expect(ratingDropOption(2, zh)).toBe("0.2 星");
  });
});
