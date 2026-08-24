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
import { WebhookItem, WebhookTestResult } from '@asobeast/shared';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: 'List configured alert webhooks' })
  list(): Promise<WebhookItem[]> {
    return this.webhooks.list();
  }

  @Post()
  @ApiOperation({ summary: 'Register an alert webhook' })
  create(@Body() dto: CreateWebhookDto): Promise<WebhookItem> {
    return this.webhooks.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an alert webhook' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ): Promise<WebhookItem> {
    return this.webhooks.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an alert webhook' })
  remove(@Param('id') id: string): Promise<void> {
    return this.webhooks.remove(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Send a sample payload to a webhook' })
  test(@Param('id') id: string): Promise<WebhookTestResult> {
    return this.webhooks.test(id);
  }
}
