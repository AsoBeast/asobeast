import { Module } from '@nestjs/common';
import { InProcessGateway } from './in-process.gateway';
import { McpBridge } from './mcp.bridge';
import { McpController } from './mcp.controller';

@Module({
  controllers: [McpController],
  providers: [InProcessGateway, McpBridge],
})
export class McpModule {}
