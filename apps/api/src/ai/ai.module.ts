import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiGateway } from './ai-gateway.service';
import { createOpenAiClient, OPENAI_CLIENT } from './openai.client';

@Module({
  providers: [
    {
      provide: OPENAI_CLIENT,
      useFactory: createOpenAiClient,
      inject: [ConfigService],
    },
    AiGateway,
  ],
  exports: [OPENAI_CLIENT, AiGateway],
})
export class AiModule {}
