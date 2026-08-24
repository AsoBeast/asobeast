import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Logger,
  Post,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { User } from '@prisma/client';
import type { WorkspaceDeletionStatus } from '@asobeast/shared';
import { AllowUnentitled } from '../auth/decorators/allow-unentitled.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OWNER_ROLE } from '../auth/workspace-roles';
import { AccountDeletionService } from './account-deletion.service';
import { AccountExportService } from './account-export.service';
import { RequestDeletionDto } from './dto/request-deletion.dto';

@ApiTags('account')
@Controller('account')
export class AccountController {
  private readonly logger = new Logger(AccountController.name);

  constructor(
    private readonly exporter: AccountExportService,
    private readonly deletion: AccountDeletionService,
  ) {}

  @Get('export')
  @AllowUnentitled()
  @ApiOperation({
    summary: 'Stream every row this workspace owns as newline delimited JSON',
  })
  async export(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="asobeast-export.ndjson"',
    );
    res.setHeader('Cache-Control', 'no-store');
    try {
      await this.exporter.stream(res);
    } catch (error) {
      if (!res.headersSent) throw error;
      this.logger.error('workspace export failed part way through', error);
      res.destroy();
      return;
    }
    res.end();
  }

  @Get('deletion')
  @AllowUnentitled()
  @ApiOperation({ summary: 'Whether this workspace is scheduled for deletion' })
  status(): Promise<WorkspaceDeletionStatus> {
    return this.deletion.status();
  }

  @Post('deletion')
  @AllowUnentitled()
  @ApiOperation({
    summary: 'Schedule this workspace for deletion after a grace period',
  })
  request(
    @CurrentUser() user: User,
    @Body() dto: RequestDeletionDto,
  ): Promise<WorkspaceDeletionStatus> {
    this.requireOwner(user);
    return this.deletion.request(user, dto.confirm);
  }

  @Delete('deletion')
  @AllowUnentitled()
  @ApiOperation({
    summary: 'Cancel a scheduled deletion during its grace period',
  })
  cancel(@CurrentUser() user: User): Promise<WorkspaceDeletionStatus> {
    this.requireOwner(user);
    return this.deletion.cancel();
  }

  private requireOwner(user: User): void {
    if (user.role !== OWNER_ROLE) {
      throw new ForbiddenException(
        'Only the workspace owner can schedule or cancel deletion',
      );
    }
  }
}
