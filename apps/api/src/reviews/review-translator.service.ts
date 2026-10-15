import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReviewTranslation } from '@asobeast/shared';
import { AiGateway } from '../ai/ai-gateway.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildTranslationContext,
  hasWords,
  languageName,
  parseTranslationOutput,
  toReviewTranslation,
  TRANSLATION_MAX_OUTPUT_TOKENS,
  TRANSLATION_SCHEMA,
  TRANSLATION_SYSTEM_PROMPT,
} from './review-translation';

@Injectable()
export class ReviewTranslator {
  constructor(
    private readonly ai: AiGateway,
    private readonly prisma: PrismaService,
  ) {}

  async translate(
    appId: string,
    reviewId: string,
    language: string,
    userId: string,
  ): Promise<ReviewTranslation> {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, appId },
    });
    if (!review) {
      throw new NotFoundException(`Review ${reviewId} not found`);
    }
    if (!hasWords(review)) {
      throw new BadRequestException(
        'A review without text has nothing to translate',
      );
    }
    if (languageName(language) === null) {
      throw new BadRequestException(`Unknown language ${language}`);
    }
    const cached =
      review.translationLanguage === language
        ? toReviewTranslation(review)
        : null;
    if (cached) return cached;

    const { output } = await this.ai.spend(
      { feature: 'reviewTranslation', appId, userId },
      {
        system: TRANSLATION_SYSTEM_PROMPT,
        content: [
          { type: 'text', text: buildTranslationContext(review, language) },
        ],
        schema: TRANSLATION_SCHEMA,
        maxOutputTokens: TRANSLATION_MAX_OUTPUT_TOKENS,
      },
    );
    const translated = parseTranslationOutput(output);
    if (!translated) {
      throw new BadGatewayException(
        'The assistant did not return a translation; please try again.',
      );
    }
    const row = await this.prisma.review.update({
      where: { id: review.id },
      data: {
        translationLanguage: language,
        sourceLanguage: translated.sourceLanguage,
        translatedTitle: translated.title,
        translatedText: translated.text,
        translatedAt: new Date(),
      },
    });
    const translation = toReviewTranslation(row);
    if (!translation) {
      throw new BadGatewayException('The translation could not be stored.');
    }
    return translation;
  }
}
