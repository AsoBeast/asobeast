import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActionAiStatus,
  ActionExplanation,
  ActionRule,
} from '@asobeast/shared';
import { AiGateway } from '../ai/ai-gateway.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseActionEvidence } from './actions.mapper';

export const ACTION_EXPLANATION_MAX_LENGTH = 600;

const SYSTEM_PROMPT = [
  'You explain an already-computed app store optimization recommendation to its owner.',
  'The recommendation, its priority and its impact score were computed deterministically',
  'from the evidence you are given. You may not change, question or re-rank them, and you',
  'may not introduce numbers, competitors, keywords or claims that are not in the evidence.',
  'Write two to four plain sentences: what was observed, why it matters, and what to check',
  'first. No headings, no lists, no marketing language.',
].join('\n');

const RULE_DESCRIPTION: Record<ActionRule, string> = {
  'keyword.add_uncovered':
    'A high-opportunity, relevant tracked keyword appears in no indexed metadata field of the home market listing.',
  'keyword.defend':
    'Several new apps entered the top 10 for a keyword this app ranks on, and at least one sits at or above its position.',
  'keyword.prune':
    'A tracked keyword has effectively never ranked, carries negligible volume and costs a daily store request.',
  'rank.investigate_drop':
    'Visibility or tracked ranks fell after an indexed metadata field changed.',
  'serp.hold_volatile':
    'This keyword’s search results are churning, so recent movement is not a reliable signal.',
  'audit.fix_factor':
    'A heavily weighted ASO audit factor is scoring badly in the newest stored audit snapshot.',
  'reviews.investigate_theme':
    'A complaint theme appears in negative reviews of the latest version materially more than in the previous version.',
  'market.improve_country':
    'A non-home market is visibly behind the home market on stored visibility. This is a signal to investigate, not a localization verdict.',
  'keyword.push_to_top10':
    'A relevant, valuable keyword has sat just outside the top 10 for most of the last week and appears only in a weak metadata field.',
  'metadata.fix_lint':
    'A home market listing field has error-level lint issues that break a store rule, such as exceeding its character limit.',
  'rank.investigate_unexplained_drop':
    'Visibility or several tracked ranks fell in a market over the last two weeks without an indexed metadata change of this app to explain it.',
  'competitor.investigate_overtake':
    'A tracked competitor changed indexed metadata and has stayed ahead of this app on relevant, valuable keywords since the change.',
  'reviews.investigate_rating_decline':
    'The average score of reviews from the last two weeks fell clearly below the three weeks before, without a single repeated complaint theme to explain it.',
  'reviews.reply_negative':
    'Several recent low Google Play reviews were checked for a developer reply and none was found.',
  'listing.ship_update':
    'The store listing has not shown a new update for at least ninety days; competitors that updated recently add to the pressure.',
};

const SCHEMA = {
  name: 'action_explanation',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['explanation'],
    properties: {
      explanation: { type: 'string', maxLength: ACTION_EXPLANATION_MAX_LENGTH },
    },
  },
};

interface ExplanationOutput {
  explanation: string;
}

function isExplanation(value: unknown): value is ExplanationOutput {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ExplanationOutput).explanation === 'string' &&
    (value as ExplanationOutput).explanation.trim().length > 0
  );
}

@Injectable()
export class ActionsAiService {
  private readonly inFlight = new Map<string, Promise<ActionExplanation>>();

  constructor(
    private readonly ai: AiGateway,
    private readonly prisma: PrismaService,
  ) {}

  status(): ActionAiStatus {
    return { configured: this.ai.configured, model: this.ai.model };
  }

  async explain(actionId: string, userId: string): Promise<ActionExplanation> {
    this.ai.requireModel();
    const existing = this.inFlight.get(actionId);
    if (existing) return existing;

    const run = this.generate(actionId, userId).finally(() =>
      this.inFlight.delete(actionId),
    );
    this.inFlight.set(actionId, run);
    return run;
  }

  private async generate(
    actionId: string,
    userId: string,
  ): Promise<ActionExplanation> {
    const model = this.ai.requireModel();

    const row = await this.prisma.actionItem.findFirst({
      where: { id: actionId },
      select: {
        id: true,
        rule: true,
        priority: true,
        impact: true,
        evidence: true,
        appId: true,
        app: { select: { name: true, store: true, country: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Action not found');
    }

    const evidence = parseActionEvidence(row.rule, row.evidence);
    if (!evidence) {
      throw new ConflictException(
        'This action has no readable evidence to explain',
      );
    }

    const { output } = await this.ai.spend(
      { feature: 'actionExplanation', appId: row.appId, userId },
      {
        system: SYSTEM_PROMPT,
        content: [
          {
            type: 'text',
            text: [
              `App: ${row.app.name ?? 'Unnamed'} (${row.app.store}, ${row.app.country})`,
              `Rule: ${row.rule}`,
              `Rule description: ${RULE_DESCRIPTION[evidence.rule]}`,
              `Priority: ${row.priority}`,
              `Estimated impact: ${row.impact} of 100`,
              `Evidence: ${JSON.stringify(evidence)}`,
            ].join('\n'),
          },
        ],
        schema: SCHEMA,
      },
    );

    if (!isExplanation(output)) {
      throw new BadGatewayException('AI returned an unusable explanation');
    }

    const generatedAt = new Date();
    const explanation = output.explanation.trim();
    await this.prisma.actionItem.update({
      where: { id: actionId },
      data: {
        aiExplanation: explanation,
        aiModel: model,
        aiGeneratedAt: generatedAt,
      },
    });

    return {
      explanation,
      model,
      generatedAt: generatedAt.toISOString(),
    };
  }
}
