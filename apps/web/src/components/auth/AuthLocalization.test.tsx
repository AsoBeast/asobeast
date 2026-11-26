import type { AuthUser } from "@asobeast/shared";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { catalogs } from "@/i18n/messages";
import zhAuth from "../../../messages/zh-CN/auth.json";
import { AcceptInviteForm } from "./AcceptInviteForm";
import { ConfirmAlertContent } from "./ConfirmAlertContent";
import { ConfirmEmailContent } from "./ConfirmEmailContent";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { SessionCheck } from "./SessionCheck";
import { SessionNotKeptAlert } from "./SessionNotKeptAlert";
import { UnsubscribeContent } from "./UnsubscribeContent";
import { VerifyEmailContent } from "./VerifyEmailContent";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("alert=alert&token=token"),
}));

vi.mock("nuqs", () => ({
  useQueryState: () => [null, () => undefined],
}));

vi.mock("./use-auth", () => ({
  useAuth: () => ({
    authenticated: false,
    status: { registrationOpen: true },
  }),
}));

vi.mock("./use-leave-for", () => ({
  useLeaveFor: () => false,
}));

const CONFIRM_USER: AuthUser = {
  id: "user-1",
  email: "owner@example.com",
  emailVerified: false,
  name: null,
  role: "owner",
  plan: "trial",
  trialEndsAt: null,
  planExpiresAt: null,
  entitled: false,
  trialAwaitsCheckout: true,
  platformOperator: false,
  entryStep: "confirm-email",
};

function chineseMarkup(
  node: ReactNode,
  auth: Record<string, unknown> = zhAuth,
): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale="zh-CN"
      timeZone="UTC"
      messages={{ ...catalogs["zh-CN"], auth }}
    >
      <QueryClientProvider client={new QueryClient()}>
        {node}
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("Simplified Chinese authentication flows", () => {
  it("renders registration, password guidance, and legal consent in Chinese", () => {
    const markup = chineseMarkup(<RegisterForm billing />);

    expect(markup).toContain("创建账号");
    expect(markup).toContain("名称（可选）");
    expect(markup).toContain("至少 10 个字符。");
    expect(markup).toContain("已有账号？");
    expect(markup).toContain("服务条款");
    expect(markup).toContain("隐私政策");
    expect(markup).toContain("确认您已年满 18 岁");
    expect(markup).not.toContain("Create account");
  });

  it("renders the forgot-password form in Chinese", () => {
    const markup = chineseMarkup(<ForgotPasswordForm />);

    expect(markup).toContain("重置密码");
    expect(markup).toContain("请输入邮箱，我们会向您发送恢复链接。");
    expect(markup).toContain("发送恢复链接");
    expect(markup).toContain("返回登录");
    expect(markup).not.toContain("Email me a link");
  });

  it("renders the reset-password form in Chinese", () => {
    const markup = chineseMarkup(<ResetPasswordForm />);

    expect(markup).toContain("设置新密码");
    expect(markup).toContain("新密码");
    expect(markup).toContain("至少 10 个字符。");
    expect(markup).toContain("设置新密码");
    expect(markup).not.toContain("Set new password");
  });

  it("renders the invitation form in Chinese", () => {
    const markup = chineseMarkup(<AcceptInviteForm billing={false} />);

    expect(markup).toContain("加入工作区");
    expect(markup).toContain("名称（可选）");
    expect(markup).toContain("接受邀请");
    expect(markup).toContain("已有账号？");
    expect(markup).not.toContain("Accept invitation");
  });

  it("renders email verification in Chinese", () => {
    const markup = chineseMarkup(<VerifyEmailContent />);

    expect(markup).toContain("确认您的邮箱");
    expect(markup).toContain("确认我的邮箱");
    expect(markup).toContain("以其他账号登录？请先退出登录");
    expect(markup).not.toContain("Confirm my email");
  });

  it("renders alert confirmation in Chinese", () => {
    const markup = chineseMarkup(<ConfirmAlertContent />);

    expect(markup).toContain("确认提醒邮件？");
    expect(markup).toContain("确认邮箱地址");
    expect(markup).toContain("排名、元数据和评论变化");
    expect(markup).not.toContain("Confirm alert emails?");
  });

  it("renders unsubscribe confirmation in Chinese", () => {
    const markup = chineseMarkup(<UnsubscribeContent />);

    expect(markup).toContain("停止邮件提醒？");
    expect(markup).toContain("退订");
    expect(markup).toContain("将停止接收此 AsoBeast 邮件提醒");
    expect(markup).not.toContain("Stop email alerts?");
  });

  it("renders session status and cookie recovery guidance in Chinese", () => {
    const status = chineseMarkup(<SessionCheck />);
    const alert = chineseMarkup(
      <SessionNotKeptAlert outcome="账号已创建。" offerSignIn />,
    );

    expect(status).toContain('aria-label="正在检查您的会话"');
    expect(alert).toContain("浏览器未保留会话 Cookie");
    expect(alert).toContain("账号已创建。");
    expect(alert).toContain("故障排查指南");
    expect(alert).toContain("前往登录");
    expect(alert).not.toContain("Your browser did not keep");
  });

  it("lets translated rich messages control the order of auth links and prompts", () => {
    const auth = {
      ...zhAuth,
      needAccountLink: "<link>创建账号</link>，还没有账号？",
      haveAccountLink: "<link>登录</link>，已有账号？",
      confirmEmail: {
        ...zhAuth.confirmEmail,
        registerAgainLink: "请<link>退出登录</link>，然后重新注册。",
      },
    };

    const login = chineseMarkup(<LoginForm />, auth);
    const register = chineseMarkup(<RegisterForm billing={false} />, auth);
    const invite = chineseMarkup(<AcceptInviteForm billing={false} />, auth);
    const confirm = chineseMarkup(
      <ConfirmEmailContent user={CONFIRM_USER} />,
      auth,
    );

    expect(login).toContain(">创建账号</a>，还没有账号？");
    expect(register).toContain(">登录</a>，已有账号？");
    expect(invite).toContain(">登录</a>，已有账号？");
    expect(confirm).toContain("退出登录</span></button>，然后重新注册。");
  });

  it("renders rich email-confirmation copy in Chinese", () => {
    const markup = chineseMarkup(<ConfirmEmailContent user={CONFIRM_USER} />);

    expect(markup).toContain("确认您的邮箱");
    expect(markup).toContain("owner@example.com");
    expect(markup).toContain("感谢注册");
    expect(markup).toContain("免费试用");
    expect(markup).toContain("邮箱地址有误？");
    expect(markup).toContain("并重新注册。");
    expect(markup).not.toContain("Thank you for registering");
  });
});
