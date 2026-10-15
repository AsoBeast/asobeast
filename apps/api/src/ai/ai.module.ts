import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiGateway } from './ai-gateway.service';
import { createOpenAiClient, OPENAI_CLIENT } from './openai.client';

@Module({
  controllers: [AiController],
  providers: [
    {
      provide: OPENAI_CLIENT,
      useFactory: createOpenAiClient,
      inject: [ConfigService],
    },
    AiGateway,
  ],
  exports: [AiGateway],
})
export class AiModule {}
