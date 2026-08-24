import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { RateLimitClass, SkipRateLimit } from '../auth/rate-limit/rate-class';
import { ReadOnlyEndpoint } from '../auth/read-access';
import { McpBridge } from './mcp.bridge';

export const MCP_ROUTE = 'mcp';

@ApiExcludeController()
@Controller(MCP_ROUTE)
@RateLimitClass('read')
@ReadOnlyEndpoint()
@SkipRateLimit()
export class McpController {
  constructor(private readonly bridge: McpBridge) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown,
  ): Promise<void> {
    await this.bridge.admit(req);
    await this.bridge.serve(req, res, body);
  }
}
