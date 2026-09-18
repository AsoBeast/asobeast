import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { AiClient, OPENAI_CLIENT } from '../ai/openai.client';
import {
  CREATIVE_MAX_OUTPUT_TOKENS,
  CREATIVE_OBSERVATIONS_JSON_SCHEMA,
  CreativeInputs,
  CreativeObservations,
  MAX_ANALYZED_SCREENSHOTS,
  MAX_COMPETITOR_ICONS,
  parseObservations,
} from './creative/creative-observations';
import {
  buildCreativeContent,
  CREATIVE_SYSTEM_PROMPT,
} from './creative/creative-prompt';

@Injectable()
export class AuditAiService {
  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: AiClient | null,
  ) {}

  get configured(): boolean {
    return this.client !== null;
  }

  get model(): string | null {
    return this.client?.model ?? null;
  }

  async observe(inputs: CreativeInputs): Promise<CreativeObservations> {
    if (!this.client) {
      throw new ConflictException('AI features require OPENAI_API_KEY');
    }
    const raw = await this.client.structured({
      system: CREATIVE_SYSTEM_PROMPT,
      content: buildCreativeContent(inputs),
      schema: {
        name: 'creative_observations',
        schema: CREATIVE_OBSERVATIONS_JSON_SCHEMA,
      },
      maxOutputTokens: CREATIVE_MAX_OUTPUT_TOKENS,
    });
    return parseObservations(raw, {
      icon: inputs.iconUrl !== null,
      screenshots: Math.min(
        inputs.screenshotUrls.length,
        MAX_ANALYZED_SCREENSHOTS,
      ),
      competitorIcons: Math.min(
        inputs.competitorIconUrls.length,
        MAX_COMPETITOR_ICONS,
      ),
    });
  }
}
