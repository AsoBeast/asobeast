import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppSetupState } from '@asobeast/shared';
import { AppSetupService } from './app-setup.service';
import { UpdateAppSetupDto } from './dto/update-app-setup.dto';

@ApiTags('apps')
@Controller('apps/:id')
export class AppSetupController {
  constructor(private readonly setups: AppSetupService) {}

  @Get('setup')
  @ApiOperation({
    summary: 'Read the guided setup of an app',
    description:
      'The status, the skipped steps, whether countries were reviewed and the selected markets of the guided setup, kept on the account so every member and every device sees the same progress. An import starts it in progress; a primary app without a row answers not_started with its home market selected and updatedAt null. Answers 404 for a competitor or an unknown app.',
  })
  read(@Param('id') id: string): Promise<AppSetupState> {
    return this.setups.read(id);
  }

  @Patch('setup')
  @ApiOperation({
    summary: 'Update the guided setup of an app',
    description:
      'Changes the fields given and keeps the rest; an empty body changes nothing. Skipped steps are stored in step order. completed stamps completedAt once and keeps that time when completed again; any other status clears it. Answers 400 for an unknown status or step, a repeated step or market, a market that is not a lowercase two letter code, no market or more than 50, and 404 for a competitor or an unknown app.',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAppSetupDto,
  ): Promise<AppSetupState> {
    return this.setups.update(id, dto);
  }
}
