import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiStatus } from '@asobeast/shared';
import { AiGateway } from './ai-gateway.service';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiGateway) {}

  @Get('status')
  @ApiOperation({ summary: 'Whether the optional AI features are configured' })
  status(): AiStatus {
    return { configured: this.ai.configured, model: this.ai.model };
  }
}
