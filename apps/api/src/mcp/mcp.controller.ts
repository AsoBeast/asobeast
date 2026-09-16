import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { RateLimitClass, SkipRateLimit } from '../auth/rate-limit/rate-class';
import { ReadOnlyEndpoint } from '../auth/read-access';
import { McpBridge } from './mcp.bridge';

export const MCP_ROUTE = 'mcp';

const METHOD_NOT_ALLOWED = {
  jsonrpc: '2.0',
  error: { code: -32000, message: 'Method not allowed.' },
  id: null,
} as const;

function refuseMethod(res: Response): void {
  res.status(405).set('Allow', 'POST').json(METHOD_NOT_ALLOWED);
}

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

  @Get()
  refuseListen(@Res() res: Response): void {
    refuseMethod(res);
  }

  @Delete()
  refuseTermination(@Res() res: Response): void {
    refuseMethod(res);
  }
}
