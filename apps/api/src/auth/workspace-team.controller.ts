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
import {
  SESSION_COOKIE,
  type AuthUser,
  type WorkspaceInviteCreated,
  type WorkspaceTeam,
} from '@asobeast/shared';
import { AuthService } from './auth.service';
import type { AccountUser } from './auth.types';
import { AllowUnentitled } from './decorators/allow-unentitled.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { OwnerGuard } from './guards/owner.guard';
import { WorkspaceTeamService } from './workspace-team.service';

@ApiTags('auth')
@Controller('workspace')
export class WorkspaceTeamController {
  constructor(
    private readonly team: WorkspaceTeamService,
    private readonly auth: AuthService,
  ) {}

  @Get('team')
  @AllowUnentitled()
  @ApiOperation({ summary: 'Members of this workspace and pending invites' })
  list(): Promise<WorkspaceTeam> {
    return this.team.team();
  }

  @Post('invites')
  @UseGuards(OwnerGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Invite a member into this workspace' })
  invite(
    @CurrentUser() user: AccountUser,
    @Body() dto: InviteMemberDto,
  ): Promise<WorkspaceInviteCreated> {
    return this.team.invite(user, dto.email);
  }

  @Delete('invites/:id')
  @UseGuards(OwnerGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a pending invitation' })
  revoke(@Param('id') id: string): Promise<void> {
    return this.team.revoke(id);
  }

  @Delete('members/:id')
  @UseGuards(OwnerGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a member from this workspace' })
  remove(
    @CurrentUser() user: AccountUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.team.remove(user, id);
  }

  @Post('invites/accept')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Accept an invitation and create the account' })
  async accept(
    @Req() req: Request,
    @Body() dto: AcceptInviteDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    const cookies = req.cookies as Record<string, string> | undefined;
    const signedIn = await this.auth.resolveSessionUser(
      cookies?.[SESSION_COOKIE],
    );
    const user = await this.team.accept(
      dto.token,
      dto.password,
      dto.name ?? null,
      signedIn,
    );
    res.cookie(
      SESSION_COOKIE,
      await this.auth.sign(user),
      this.auth.cookieOptions(),
    );
    return this.auth.toAuthUser(user);
  }
}
