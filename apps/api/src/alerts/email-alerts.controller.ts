import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmailAlertItem, WebhookTestResult } from '@asobeast/shared';
import { CreateEmailAlertDto } from './dto/create-email-alert.dto';
import { UpdateEmailAlertDto } from './dto/update-email-alert.dto';
import { EmailAlertsService } from './email-alerts.service';

@ApiTags('email-alerts')
@Controller('email-alerts')
export class EmailAlertsController {
  constructor(private readonly emailAlerts: EmailAlertsService) {}

  @Get()
  @ApiOperation({ summary: 'List configured email alerts' })
  list(): Promise<EmailAlertItem[]> {
    return this.emailAlerts.list();
  }

  @Post()
  @ApiOperation({ summary: 'Register an email alert' })
  create(@Body() dto: CreateEmailAlertDto): Promise<EmailAlertItem> {
    return this.emailAlerts.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an email alert' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmailAlertDto,
  ): Promise<EmailAlertItem> {
    return this.emailAlerts.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an email alert' })
  remove(@Param('id') id: string): Promise<void> {
    return this.emailAlerts.remove(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Send a sample email to an alert recipient' })
  test(@Param('id') id: string): Promise<WebhookTestResult> {
    return this.emailAlerts.test(id);
  }
}
