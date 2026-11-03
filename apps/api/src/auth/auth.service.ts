import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions } from 'express';
import * as argon2 from 'argon2';
import {
  API_TOKEN_PREFIX,
  API_TOKEN_SCOPES,
  DEFAULT_API_TOKEN_SCOPE,
  type ApiTokenCreated,
  type ApiTokenItem,
  type ApiTokenScope,
  type AuthStatus,
  type AuthUser,
} from '@asobeast/shared';
import { Prisma, type ApiToken, type User } from '@prisma/client';
import { revokeApiTokens } from './api-token-revocation';
import type { AccountUser, ResolvedToken, SessionClaims } from './auth.types';
import { isPlatformOperator } from './platform-operator';
import type { CreateTokenDto } from './dto/create-token.dto';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { EmailVerificationService } from './email-verification.service';
import { sha256 } from './password-hash';
import { canStartTrial } from './trial-grant';
import { TrialOffers } from './trial-offers';
import { EntrySteps } from './entry-steps';
import { sessionClaimsOf } from './session-claims';
import { endSessions, SessionStore } from './session-store';
import { DEFAULT_WORKSPACE_ID } from '../common/tenancy/default-workspace';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { apiToken } from './bearer-token';
import { isEntitled } from './entitlement';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { RegisterDto } from './dto/register.dto';
import { SignupCapacityGate } from './signup-capacity.gate';
import { lockRegistration } from './registration-lock';
import type { LoginDto } from './dto/login.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly crossTenant: CrossTenantAccess,
    private readonly signupCapacity: SignupCapacityGate,
    private readonly verification: EmailVerificationService,
    private readonly sessions: SessionStore,
    private readonly trialOffers: TrialOffers,
    private readonly entrySteps: EntrySteps,
  ) {}

  private beforeSignIn<T>(work: () => Promise<T>): Promise<T> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      'accounts are resolved before the caller has a workspace',
      work,
    );
  }

  get billing(): boolean {
    return this.config.get('BILLING_ENABLED', { infer: true });
  }

  async register(dto: RegisterDto): Promise<{
    user: AccountUser;
    token: string;
  }> {
    await this.signupCapacity.assertRoomForOneMore();
    return this.beforeSignIn(() => this.createAccount(dto));
  }

  private get ownWorkspacePerAccount(): boolean {
    return (
      this.billing ||
      this.config.get('AUTH_REGISTRATION_WORKSPACE', { infer: true }) === 'own'
    );
  }

  private async createAccount(dto: RegisterDto): Promise<{
    user: AccountUser;
    token: string;
  }> {
    const email = normalizeEmail(dto.email);
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.withTransaction(async (tx) => {
      await lockRegistration(tx);
      const bootstrap = (await tx.user.count()) === 0;
      if (!bootstrap && !this.registrationAllowed()) {
        throw new ForbiddenException('Registration is closed');
      }
      if (await tx.user.findUnique({ where: { email } })) {
        throw new ConflictException('Email already registered');
      }
      const ownWorkspace = !bootstrap && this.ownWorkspacePerAccount;
      return tx.user.create({
        data: {
          workspaceId: ownWorkspace
            ? await this.newWorkspace(tx, email)
            : await this.defaultWorkspace(tx, email),
          email,
          passwordHash,
          name: dto.name ?? null,
          role: bootstrap || ownWorkspace ? 'owner' : 'member',
        },
        include: { workspace: true },
      });
    });
    await this.verification.invite(user);
    return { user, token: await this.openSession(user) };
  }

  private async newWorkspace(
    tx: Prisma.TransactionClient,
    email: string,
  ): Promise<string> {
    const workspace = await tx.workspace.create({
      data: {
        name: email,
        ...(await this.verification.openingTerms(tx, email)),
      },
      select: { id: true },
    });
    return workspace.id;
  }

  private async defaultWorkspace(
    tx: Prisma.TransactionClient,
    email: string,
  ): Promise<string> {
    const existing = await tx.workspace.findUnique({
      where: { id: DEFAULT_WORKSPACE_ID },
    });
    if (!existing) {
      await tx.workspace.create({
        data: {
          id: DEFAULT_WORKSPACE_ID,
          name: 'Default',
          ...(await this.verification.openingTerms(tx, email)),
        },
      });
      return DEFAULT_WORKSPACE_ID;
    }
    if (!canStartTrial(existing, new Date())) return DEFAULT_WORKSPACE_ID;
    const opening = await this.verification.openingTerms(tx, email);
    if (opening) {
      await this.verification.writeTerms(tx, existing, opening);
    }
    return DEFAULT_WORKSPACE_ID;
  }

  login(dto: LoginDto): Promise<{ user: AccountUser; token: string }> {
    return this.beforeSignIn(async () => {
      const email = normalizeEmail(dto.email);
      const user = await this.prisma.user.findUnique({
        where: { email },
        include: { workspace: true },
      });
      const hash = user?.passwordHash ?? (await this.getDummyHash());
      const valid = await argon2.verify(hash, dto.password);
      if (!user || !valid) {
        throw new UnauthorizedException('Invalid email or password');
      }
      return { user, token: await this.openSession(user) };
    });
  }

  async changePassword(
    user: User,
    dto: ChangePasswordDto,
  ): Promise<{ user: AccountUser; token: string }> {
    const valid = await argon2.verify(user.passwordHash, dto.current);
    if (!valid) {
      throw new UnauthorizedException('Invalid current password');
    }
    const passwordHash = await argon2.hash(dto.next);
    return this.beforeSignIn(() =>
      this.prisma.withTransaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id: user.id },
          data: { passwordHash, sessionVersion: { increment: 1 } },
          include: { workspace: true },
        });
        await revokeApiTokens(tx, user.id);
        await endSessions(tx, user.id);
        return { user: updated, token: await this.signSession(tx, updated) };
      }),
    );
  }

  async endSession(sessionId: string | undefined): Promise<void> {
    if (!sessionId) return;
    await this.beforeSignIn(() => this.sessions.end(sessionId));
  }

  async requireSessionUser(token: string | undefined): Promise<AccountUser> {
    const user = await this.resolveSessionUser(token);
    if (!user) throw new UnauthorizedException('Not authenticated');
    return user;
  }

  async resolveSessionUser(
    token: string | undefined,
  ): Promise<AccountUser | null> {
    const claims = await this.verifySession(token);
    return claims && this.userOfSession(claims);
  }

  async verifySession(
    token: string | undefined,
  ): Promise<SessionClaims | null> {
    if (!token) return null;
    try {
      return sessionClaimsOf(await this.jwt.verifyAsync<object>(token));
    } catch {
      return null;
    }
  }

  userOfSession(claims: SessionClaims): Promise<AccountUser | null> {
    return this.beforeSignIn(async () => {
      const session = await this.sessions.find(claims.jti);
      const user = session?.user;
      if (!user || user.id !== claims.sub) return null;
      if (user.sessionVersion !== claims.sv) return null;
      return user;
    });
  }

  async listTokens(user: User, now = new Date()): Promise<ApiTokenItem[]> {
    const rows = await this.prisma.apiToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => toApiTokenItem(row, now));
  }

  async createToken(
    user: User,
    dto: CreateTokenDto,
    now = new Date(),
  ): Promise<ApiTokenCreated> {
    const token = API_TOKEN_PREFIX + randomBytes(24).toString('hex');
    const row = await this.prisma.apiToken.create({
      data: {
        userId: user.id,
        name: dto.name,
        tokenHash: sha256(token),
        prefix: token.slice(0, 12),
        scope: dto.scope ?? DEFAULT_API_TOKEN_SCOPE,
        expiresAt: expiryOf(dto.expiresInDays, now),
      },
    });
    return { ...toApiTokenItem(row, now), token };
  }

  async revokeToken(user: User, id: string): Promise<void> {
    await this.prisma.apiToken.deleteMany({ where: { id, userId: user.id } });
  }

  resolveToken(
    authorization: string | undefined,
    now = new Date(),
  ): Promise<ResolvedToken | null> {
    return this.beforeSignIn(async () => {
      const raw = apiToken(authorization);
      if (!raw) return null;
      const record = await this.prisma.apiToken.findUnique({
        where: { tokenHash: sha256(raw) },
        include: { user: { include: { workspace: true } } },
      });
      if (!record || hasExpired(record, now)) return null;
      await this.prisma.apiToken
        .update({
          where: { id: record.id },
          data: { lastUsedAt: now, usageCount: { increment: 1 } },
        })
        .catch(() => undefined);
      return { user: record.user, scope: scopeOf(record) };
    });
  }

  async status(token: string | undefined): Promise<AuthStatus> {
    const users = await this.beforeSignIn(() => this.prisma.user.count());
    return {
      billing: this.billing,
      registrationOpen: this.registrationAllowed() || users === 0,
      setupRequired: users === 0,
      authenticated: (await this.resolveSessionUser(token)) !== null,
    };
  }

  openSession(user: User): Promise<string> {
    return this.beforeSignIn(() =>
      this.prisma.withTransaction((tx) => this.signSession(tx, user)),
    );
  }

  private async signSession(
    tx: Prisma.TransactionClient,
    user: User,
    now = new Date(),
  ): Promise<string> {
    const jti = await this.sessions.open(
      tx,
      user.id,
      new Date(now.getTime() + this.sessionLifetimeMs()),
    );
    const claims: SessionClaims = {
      sub: user.id,
      sv: user.sessionVersion,
      jti,
    };
    return this.jwt.signAsync(claims);
  }

  private sessionLifetimeMs(): number {
    return this.config.get('AUTH_SESSION_DAYS', { infer: true }) * DAY_MS;
  }

  async toAuthUser(
    user: AccountUser,
    tokenScope?: ApiTokenScope,
  ): Promise<AuthUser> {
    const entryStep = this.entrySteps.stepFor(user);
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      name: user.name,
      role: user.role,
      plan: user.workspace.plan,
      trialEndsAt: user.workspace.trialEndsAt?.toISOString() ?? null,
      planExpiresAt: user.workspace.planExpiresAt?.toISOString() ?? null,
      entitled: this.entitled(user),
      trialAwaitsConfirmation: this.verification.awaitsConfirmation(user),
      trialAwaitsCheckout: (await this.trialOffers.offerFor(user)) !== null,
      trialing: user.workspace.subscriptionStatus === 'trialing',
      platformOperator: isPlatformOperator(user),
      suspendedAt: user.workspace.suspendedAt?.toISOString() ?? null,
      suspendedReason: user.workspace.suspendedReason,
      ...(tokenScope === undefined ? {} : { tokenScope }),
      ...(entryStep === undefined ? {} : { entryStep }),
    };
  }

  cookieOptions(): CookieOptions {
    return {
      ...this.baseCookieOptions(),
      maxAge: this.sessionLifetimeMs(),
    };
  }

  clearCookieOptions(): CookieOptions {
    return this.baseCookieOptions();
  }

  entitled(user: AccountUser): boolean {
    return !this.billing || isEntitled(user.workspace, new Date());
  }

  private baseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: this.config.get('AUTH_COOKIE_SECURE', { infer: true }),
    };
  }

  registrationAllowed(): boolean {
    return (
      this.billing ||
      this.config.get('AUTH_ALLOW_REGISTRATION', { infer: true })
    );
  }

  private getDummyHash(): Promise<string> {
    return (this.dummyHash ??= argon2.hash(randomBytes(16).toString('hex')));
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function scopeOf(row: ApiToken): ApiTokenScope {
  return API_TOKEN_SCOPES.includes(row.scope as ApiTokenScope)
    ? (row.scope as ApiTokenScope)
    : DEFAULT_API_TOKEN_SCOPE;
}

function hasExpired(row: ApiToken, now: Date): boolean {
  return row.expiresAt !== null && row.expiresAt <= now;
}

function expiryOf(days: number | undefined, now: Date): Date | null {
  return days === undefined ? null : new Date(now.getTime() + days * DAY_MS);
}

function toApiTokenItem(row: ApiToken, now: Date): ApiTokenItem {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scope: scopeOf(row),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    expired: hasExpired(row, now),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    usageCount: row.usageCount,
    createdAt: row.createdAt.toISOString(),
  };
}
