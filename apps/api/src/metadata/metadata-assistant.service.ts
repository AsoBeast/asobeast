import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Store } from '@prisma/client';
import {
  LintContext,
  MetadataAssistantResult,
  MetadataAssistantStatus,
  MetadataField,
  tokenize,
} from '@asobeast/shared';
import { AiClient, OPENAI_CLIENT } from '../ai/openai.client';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetadataAssistantDto } from './dto/metadata-assistant.dto';
import {
  buildAssistantContext,
  currentValue,
  draftSchema,
  SYSTEM_PROMPT,
  validateDrafts,
} from './metadata-drafts';
import { MetadataService } from './metadata.service';

const DEFAULT_FIELDS: Record<Store, MetadataField[]> = {
  APP_STORE: ['title', 'subtitle', 'keywordField'],
  GOOGLE_PLAY: ['title', 'shortDescription', 'description'],
};

@Injectable()
export class MetadataAssistantService {
  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: AiClient | null,
    private readonly prisma: PrismaService,
    private readonly keywords: KeywordsService,
    private readonly metadata: MetadataService,
  ) {}

  status(): MetadataAssistantStatus {
    return {
      configured: this.client !== null,
      model: this.client?.model ?? null,
    };
  }

  async generate(
    appId: string,
    dto: MetadataAssistantDto,
  ): Promise<MetadataAssistantResult> {
    if (!this.client) {
      throw new ConflictException('AI features require OPENAI_API_KEY');
    }
    const app = await this.ensureApp(appId);
    const fields = this.resolveFields(app.store, dto.fields);
    const [audit, tracked, competitors] = await Promise.all([
      this.metadata.audit(appId),
      this.keywords.listTracked(appId, undefined, app.country),
      this.prisma.app.findMany({
        where: { primaryAppId: appId },
        select: {
          name: true,
          snapshots: {
            orderBy: { capturedAt: 'desc' },
            take: 1,
            select: { title: true },
          },
        },
      }),
    ]);

    const active = tracked.filter((item) => item.active);
    const competitorTitles = competitors
      .map((competitor) => competitor.snapshots[0]?.title)
      .filter((title): title is string => Boolean(title));
    const competitorNames = competitors
      .map((competitor) => competitor.name)
      .filter((name): name is string => Boolean(name));

    const raw = await this.client.structured({
      system: SYSTEM_PROMPT,
      content: [
        {
          type: 'text',
          text: buildAssistantContext(
            app.store,
            fields,
            audit,
            active,
            competitorTitles,
            dto.instructions,
          ),
        },
      ],
      schema: draftSchema(fields),
    });

    const base: LintContext = {
      titleWords: tokenize(currentValue(audit, 'title')),
      subtitleWords: tokenize(currentValue(audit, 'subtitle')),
      brandTokens: tokenize(app.name ?? ''),
      competitorNames,
      trackedKeywords: active.map((item) => item.text),
    };

    const drafts = validateDrafts(raw, app.store, fields, base);
    const missing = fields.filter(
      (field) => !drafts.some((draft) => draft.field === field),
    );
    if (missing.length > 0) {
      throw new BadGatewayException(
        `The assistant did not return drafts for: ${missing.join(', ')}; please try again.`,
      );
    }

    return { model: this.client.model, drafts };
  }

  private resolveFields(
    store: Store,
    requested?: MetadataField[],
  ): MetadataField[] {
    const supported = DEFAULT_FIELDS[store];
    if (!requested || requested.length === 0) {
      return supported;
    }
    const unsupported = requested.filter((field) => !supported.includes(field));
    if (unsupported.length > 0) {
      throw new BadRequestException(
        `${store} does not support drafting: ${unsupported.join(', ')}. Draftable fields: ${supported.join(', ')}.`,
      );
    }
    return [...new Set(requested)];
  }

  private async ensureApp(appId: string): Promise<{
    id: string;
    store: Store;
    country: string;
    name: string | null;
  }> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId },
      select: { id: true, store: true, country: true, name: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }
    return app;
  }
}
