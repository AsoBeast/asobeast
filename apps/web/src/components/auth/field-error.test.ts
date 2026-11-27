import { PASSWORD_RULE } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import {
  authApiErrorMessage,
  authFieldError,
  fieldErrorProps,
  fieldOfAuthError,
  passwordFormError,
} from "./field-error";

const envelope = (statusCode: number, message: string) => ({
  statusCode,
  error: "Error",
  message,
  path: "/auth/register",
  timestamp: "2026-09-14T00:00:00.000Z",
});

describe("fieldOfAuthError", () => {
  it.each([
    [409, "Email already registered", "email"],
    [401, "Invalid current password", "current"],
    [400, "email must be an email", "email"],
    [400, "password must be longer than or equal to 10 characters", "password"],
    [400, "next must be shorter than or equal to 128 characters", "password"],
    [400, PASSWORD_RULE, "password"],
    [400, "current must be a string", "current"],
    [400, "name must be shorter than or equal to 80 characters", "form"],
    [401, "Invalid email or password", "form"],
    [403, "Registration is closed", "form"],
    [
      429,
      "Too many attempts from this address. Try again in 42 seconds.",
      "form",
    ],
    [500, "The server encountered an unexpected error.", "form"],
  ] as const)("puts a %i %j on the %s", (statusCode, message, field) => {
    expect(fieldOfAuthError(envelope(statusCode, message))).toBe(field);
  });
});

describe("authFieldError", () => {
  it("keeps the api message and the field it is about", () => {
    expect(
      authFieldError(
        new ApiError(envelope(409, "Email already registered")),
        "fallback",
      ),
    ).toEqual({ field: "email", message: "Email already registered" });
  });

  it("puts a network failure on the form with the fallback", () => {
    expect(authFieldError(new TypeError("fetch failed"), "fallback")).toEqual({
      field: "form",
      message: "fallback",
    });
  });
});

describe("authApiErrorMessage", () => {
  const translations: Record<string, string> = {
    invalidCredentials: "邮箱或密码不正确",
    emailRegistered: "此邮箱已注册",
    invalidCurrentPassword: "当前密码不正确",
    linkExpired: "链接已过期",
    linkInvalid: "链接无效",
  };
  const translator = (key: string) => translations[key] ?? key;

  it.each([
    ["Invalid email or password", "邮箱或密码不正确"],
    ["Email already registered", "此邮箱已注册"],
    ["That email already has an account", "此邮箱已注册"],
    ["Invalid current password", "当前密码不正确"],
    ["That verification link has expired", "链接已过期"],
    ["That confirmation link has expired", "链接已过期"],
  ])("translates the known refusal %s", (message, expected) => {
    expect(
      authApiErrorMessage(
        new ApiError(envelope(409, message)),
        "fallback",
        translator,
      ),
    ).toBe(expected);
  });

  it("uses the localized fallback for an unknown server message", () => {
    expect(
      authApiErrorMessage(
        new ApiError(envelope(500, "Unexpected server detail")),
        "请求失败，请重试",
        translator,
      ),
    ).toBe("请求失败，请重试");
  });
});

describe("passwordFormError", () => {
  it("keeps a refusal about the password on the password field", () => {
    expect(
      passwordFormError(new ApiError(envelope(400, PASSWORD_RULE)), "x"),
    ).toEqual({ field: "password", message: PASSWORD_RULE });
  });

  it("puts a refusal about a field the form does not show on the form", () => {
    expect(
      passwordFormError(
        new ApiError(envelope(409, "That email already has an account")),
        "x",
      ),
    ).toEqual({ field: "form", message: "That email already has an account" });
  });
});

describe("fieldErrorProps", () => {
  const error = { field: "password", message: PASSWORD_RULE } as const;

  it("marks the field the error is about and describes it by rule and error", () => {
    expect(
      fieldErrorProps(error, "password", "password-error", "rule"),
    ).toEqual({
      "aria-invalid": true,
      "aria-describedby": "rule password-error",
    });
  });

  it("leaves every other field valid and described by its rule only", () => {
    expect(fieldErrorProps(error, "email", "email-error")).toEqual({
      "aria-invalid": false,
      "aria-describedby": undefined,
    });
    expect(fieldErrorProps(null, "password", "password-error", "rule")).toEqual(
      { "aria-invalid": false, "aria-describedby": "rule" },
    );
  });
});
