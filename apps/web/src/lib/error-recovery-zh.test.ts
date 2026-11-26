import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import zhErrors from "../../messages/zh-CN/errors.json";
import { ApiError } from "@/lib/api";
import { recoveryFor } from "./error-recovery";

function apiError(
  statusCode: number,
  retryAfterSeconds?: number,
  message = "Too many refreshes",
): ApiError {
  return new ApiError({
    statusCode,
    error: "Error",
    message,
    path: "/health",
    timestamp: new Date().toISOString(),
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  });
}

describe("Simplified Chinese error recovery", () => {
  it("translates recovery copy and actions", () => {
    const translator = createTranslator({
      locale: "zh-CN",
      namespace: "errors",
      messages: { errors: zhErrors },
      timeZone: "UTC",
    });
    const context = { translator, locale: "zh-CN" as const };

    expect(
      recoveryFor(new TypeError("Failed to fetch"), undefined, context),
    ).toMatchObject({
      title: "无法连接 AsoBeast",
      body: "请求完成前连接中断。请检查网络后重试。",
    });
    expect(recoveryFor(apiError(401), undefined, context).action).toEqual({
      kind: "link",
      href: "/login",
      label: "登录",
    });
    expect(recoveryFor(apiError(429, 4), undefined, context).body).toContain(
      "4秒钟后",
    );
  });

  it("uses localized summaries and keeps unknown server text as detail", () => {
    const translator = createTranslator({
      locale: "zh-CN",
      namespace: "errors",
      messages: { errors: zhErrors },
      timeZone: "UTC",
    });
    const context = { translator, locale: "zh-CN" as const };

    expect(
      recoveryFor(
        apiError(400, undefined, "email must be valid"),
        undefined,
        context,
      ),
    ).toMatchObject({
      title: "出了点问题",
      body: "请求未能完成。重试通常可以解决临时故障。",
      detail: "email must be valid",
    });
    expect(
      recoveryFor(
        apiError(503, undefined, "database unavailable"),
        undefined,
        context,
      ),
    ).toMatchObject({
      title: "API 未能响应",
      body: "请求未能完成，请稍后重试。",
      detail: "database unavailable",
    });
  });
});
