import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenAiClient, OPENAI_CLIENT } from './openai.client';

@Module({
  providers: [
    {
      provide: OPENAI_CLIENT,
      useFactory: createOpenAiClient,
      inject: [ConfigService],
    },
  ],
  exports: [OPENAI_CLIENT],
})
export class AiModule {}
