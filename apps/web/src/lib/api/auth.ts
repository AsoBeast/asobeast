import type {
  AcceptInviteRequest,
  AccountPlan,
  ApiTokenCreateRequest,
  ApiTokenCreated,
  ApiTokenItem,
  AuthStatus,
  AuthUser,
  ChangePasswordRequest,
  InviteMemberRequest,
  LoginRequest,
  RegisterRequest,
  RequestPasswordResetRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  WorkspaceInviteCreated,
  WorkspaceTeam,
} from "@asobeast/shared";
import { apiFetch } from "./client";

export function getAuthStatus(): Promise<AuthStatus> {
  return apiFetch<AuthStatus>("/auth/status");
}

export function getAuthMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/auth/me");
}

export function getAccountPlan(): Promise<AccountPlan> {
  return apiFetch<AccountPlan>("/auth/plan");
}

export function login(email: string, password: string): Promise<AuthUser> {
  return apiFetch<AuthUser>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password } satisfies LoginRequest),
  });
}

export function register(body: RegisterRequest): Promise<AuthUser> {
  return apiFetch<AuthUser>("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function logout(): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

export function changePassword(
  current: string,
  next: string,
): Promise<AuthUser> {
  return apiFetch<AuthUser>("/auth/password", {
    method: "POST",
    body: JSON.stringify({ current, next } satisfies ChangePasswordRequest),
  });
}

export function getApiTokens(): Promise<ApiTokenItem[]> {
  return apiFetch<ApiTokenItem[]>("/auth/tokens");
}

export function createApiToken(
  request: ApiTokenCreateRequest,
): Promise<ApiTokenCreated> {
  return apiFetch<ApiTokenCreated>("/auth/tokens", {
    method: "POST",
    body: JSON.stringify(request satisfies ApiTokenCreateRequest),
  });
}

export function deleteApiToken(id: string): Promise<void> {
  return apiFetch<void>(`/auth/tokens/${id}`, { method: "DELETE" });
}

export function getWorkspaceTeam(): Promise<WorkspaceTeam> {
  return apiFetch<WorkspaceTeam>("/workspace/team");
}

export function inviteMember(email: string): Promise<WorkspaceInviteCreated> {
  return apiFetch<WorkspaceInviteCreated>("/workspace/invites", {
    method: "POST",
    body: JSON.stringify({ email } satisfies InviteMemberRequest),
  });
}

export function revokeInvite(id: string): Promise<void> {
  return apiFetch<void>(`/workspace/invites/${id}`, { method: "DELETE" });
}

export function removeMember(id: string): Promise<void> {
  return apiFetch<void>(`/workspace/members/${id}`, { method: "DELETE" });
}

export function acceptInvite(body: AcceptInviteRequest): Promise<AuthUser> {
  return apiFetch<AuthUser>("/workspace/invites/accept", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function verifyEmail(token: string): Promise<AuthUser> {
  return apiFetch<AuthUser>("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ token } satisfies VerifyEmailRequest),
  });
}

export function resendVerification(): Promise<void> {
  return apiFetch<void>("/auth/verify/resend", { method: "POST" });
}

export function requestPasswordReset(email: string): Promise<void> {
  return apiFetch<void>("/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email } satisfies RequestPasswordResetRequest),
  });
}

export function resetPassword(token: string, password: string): Promise<void> {
  return apiFetch<void>("/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ token, password } satisfies ResetPasswordRequest),
  });
}
