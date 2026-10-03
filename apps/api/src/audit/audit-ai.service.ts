import { Injectable } from '@nestjs/common';
import { AiCallRequest, AiGateway } from '../ai/ai-gateway.service';
import { AiCompletion, AiStructuredRequest } from '../ai/openai.client';
import {
  CREATIVE_MAX_OUTPUT_TOKENS,
  CREATIVE_OBSERVATIONS_JSON_SCHEMA,
  CreativeInputs,
  CreativeObservations,
  MAX_ANALYZED_SCREENSHOTS,
  parseObservations,
  sentCompetitorIcons,
} from './creative/creative-observations';
import {
  buildCreativeContent,
  CREATIVE_SYSTEM_PROMPT,
} from './creative/creative-prompt';

const creativeCall = (appId: string, userId: string | null): AiCallRequest => ({
  feature: 'creativeAnalysis',
  appId,
  userId,
});

@Injectable()
export class AuditAiService {
  constructor(private readonly ai: AiGateway) {}

  get configured(): boolean {
    return this.ai.configured;
  }

  get model(): string | null {
    return this.ai.model;
  }

  reserve(appId: string, userId: string | null): Promise<string> {
    return this.ai.reserve(creativeCall(appId, userId));
  }

  release(aiCallId: string): Promise<void> {
    return this.ai.release(aiCallId);
  }

  observe(
    inputs: CreativeInputs,
    appId: string,
    userId: string | null,
  ): Promise<CreativeObservations> {
    return this.analyze(inputs, (request) =>
      this.ai.spend(creativeCall(appId, userId), request),
    );
  }

  observeReserved(
    inputs: CreativeInputs,
    aiCallId: string,
  ): Promise<CreativeObservations> {
    return this.analyze(inputs, (request) => this.ai.charge(aiCallId, request));
  }

  private async analyze(
    inputs: CreativeInputs,
    call: (request: AiStructuredRequest) => Promise<AiCompletion>,
  ): Promise<CreativeObservations> {
    const { output } = await call({
      system: CREATIVE_SYSTEM_PROMPT,
      content: buildCreativeContent(inputs),
      schema: {
        name: 'creative_observations',
        schema: CREATIVE_OBSERVATIONS_JSON_SCHEMA,
      },
      maxOutputTokens: CREATIVE_MAX_OUTPUT_TOKENS,
    });
    return parseObservations(output, {
      icon: inputs.iconUrl !== null,
      screenshots: Math.min(
        inputs.screenshotUrls.length,
        MAX_ANALYZED_SCREENSHOTS,
      ),
      competitorIcons: sentCompetitorIcons(inputs).length,
    });
  }
}
