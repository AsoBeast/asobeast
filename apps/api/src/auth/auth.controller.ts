import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { User } from '@prisma/client';
import {
  SESSION_COOKIE,
  type AccountPlan,
  type ApiTokenCreated,
  type ApiTokenItem,
  type AuthStatus,
  type AuthUser,
} from '@asobeast/shared';
import { AccountPlanService } from './account-plan.service';
import { AuthService } from './auth.service';
import type { AccountUser } from './auth.types';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import { AllowUnentitled } from './decorators/allow-unentitled.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateTokenDto } from './dto/create-token.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly accountPlan: AccountPlanService,
    private readonly verification: EmailVerificationService,
    private readonly reset: PasswordResetService,
  ) {}

  @Post('register')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register an account' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    const { user, token } = await this.auth.register(dto);
    res.cookie(SESSION_COOKIE, token, this.auth.cookieOptions());
    return this.auth.toAuthUser(user);
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Log in' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    const { user, token } = await this.auth.login(dto);
    res.cookie(SESSION_COOKIE, token, this.auth.cookieOptions());
    return this.auth.toAuthUser(user);
  }

  @Post('logout')
  @AllowUnentitled()
  @HttpCode(204)
  @ApiOperation({ summary: 'Log out' })
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, this.auth.clearCookieOptions());
  }

  @Get('me')
  @AllowUnentitled()
  @ApiOperation({ summary: 'Current authenticated user' })
  me(@CurrentUser() user: AccountUser): AuthUser {
    return this.auth.toAuthUser(user);
  }

  @Get('plan')
  @AllowUnentitled()
  @ApiOperation({ summary: 'Workspace plan, limits and usage against them' })
  plan(@CurrentUser() user: AccountUser): Promise<AccountPlan> {
    return this.accountPlan.describe(user.workspace);
  }

  @Post('verify')
  @Public()
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Confirm an email address and start the trial' })
  async verify(
    @Req() req: Request,
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    const cookies = req.cookies as Record<string, string> | undefined;
    const signedIn = await this.auth.resolveSessionUser(
      cookies?.[SESSION_COOKIE],
    );
    const user = await this.verification.claim(dto.token, signedIn);
    res.cookie(
      SESSION_COOKIE,
      await this.auth.sign(user),
      this.auth.cookieOptions(),
    );
    return this.auth.toAuthUser(user);
  }

  @Post('verify/resend')
  @AllowUnentitled()
  @HttpCode(204)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Send a fresh confirmation link to this account' })
  resendVerification(@CurrentUser() user: AccountUser): Promise<void> {
    return this.verification.resend(user);
  }

  @Post('password')
  @AllowUnentitled()
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Change password and reset other sessions' })
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    const { user: updated, token } = await this.auth.changePassword(user, dto);
    res.cookie(SESSION_COOKIE, token, this.auth.cookieOptions());
    return this.auth.toAuthUser(updated);
  }

  @Post('password/forgot')
  @Public()
  @HttpCode(204)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Email a recovery link to an account that exists' })
  requestPasswordReset(@Body() dto: RequestPasswordResetDto): Promise<void> {
    return this.reset.request(dto.email);
  }

  @Post('password/reset')
  @Public()
  @HttpCode(204)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Redeem a recovery link and end every session' })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.reset.redeem(dto.token, dto.password);
  }

  @Get('status')
  @Public()
  @ApiOperation({ summary: 'Public auth configuration and session state' })
  status(@Req() req: Request): Promise<AuthStatus> {
    const cookies = req.cookies as Record<string, string> | undefined;
    return this.auth.status(cookies?.[SESSION_COOKIE]);
  }

  @Get('tokens')
  @ApiOperation({ summary: 'List personal api tokens' })
  listTokens(@CurrentUser() user: User): Promise<ApiTokenItem[]> {
    return this.auth.listTokens(user);
  }

  @Post('tokens')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a personal api token' })
  createToken(
    @CurrentUser() user: User,
    @Body() dto: CreateTokenDto,
  ): Promise<ApiTokenCreated> {
    return this.auth.createToken(user, dto);
  }

  @Delete('tokens/:id')
  @AllowUnentitled()
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a personal api token' })
  revokeToken(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<void> {
    return this.auth.revokeToken(user, id);
  }
}
