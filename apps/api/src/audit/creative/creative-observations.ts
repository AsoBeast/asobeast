import { createHash } from 'crypto';
import { Store } from '@prisma/client';
import { z } from 'zod';
import { AiRequestError } from '../../ai/openai.client';

export const CREATIVE_PROMPT_VERSION = 'creative-v1';
export const CREATIVE_MAX_OUTPUT_TOKENS = 4096;
export const MAX_ANALYZED_SCREENSHOTS = 6;
export const MAX_COMPETITOR_ICONS = 5;
export const MAX_CAPTION_CHARS = 140;

export const SCREENSHOT_MESSAGES = [
  'benefit',
  'feature',
  'social-proof',
  'ui-only',
  'onboarding',
  'other',
] as const;

export const ICON_ELEMENT_COUNTS = ['one', 'two', 'three-or-more'] as const;

export const ICON_CONTRASTS = ['high', 'medium', 'low'] as const;

export const creativeObservationsSchema = z.object({
  icon: z
    .object({
      hasText: z.boolean(),
      elementCount: z.enum(ICON_ELEMENT_COUNTS),
      contrast: z.enum(ICON_CONTRASTS),
      similarCompetitorPosition: z.number().int().nullable(),
    })
    .nullable(),
  screenshots: z.array(
    z.object({
      position: z.number().int(),
      captionText: z.string().nullable(),
      captionReadable: z.boolean(),
      captionLanguage: z.string().nullable(),
      message: z.enum(SCREENSHOT_MESSAGES),
    }),
  ),
  consistentStyle: z.boolean().nullable(),
});

export type CreativeObservations = z.infer<typeof creativeObservationsSchema>;
export type ScreenshotObservation = CreativeObservations['screenshots'][number];

const withoutSchemaKeyword = (
  schema: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(schema).filter(([key]) => key !== '$schema'),
  );

export const CREATIVE_OBSERVATIONS_JSON_SCHEMA = withoutSchemaKeyword(
  z.toJSONSchema(creativeObservationsSchema, { target: 'draft-7' }),
);

export interface CompetitorIcon {
  appId: string;
  iconUrl: string;
}

export interface CreativeInputs {
  store: Store;
  country: string;
  title: string;
  iconUrl: string | null;
  screenshotUrls: string[];
  competitorIcons: CompetitorIcon[];
}

export const analyzedMediaSchema = z.object({
  iconUrl: z.string().nullable(),
  screenshotUrls: z.array(z.string()),
  competitorAppIds: z.array(z.string()),
});

export type AnalyzedMedia = z.infer<typeof analyzedMediaSchema>;

const storedCreativeSchema = creativeObservationsSchema.extend({
  media: analyzedMediaSchema,
});

export type StoredCreative = z.infer<typeof storedCreativeSchema>;

export interface SentCreative {
  icon: boolean;
  screenshots: number;
  competitorIcons: number;
}

const LANGUAGE_CODE = /^[a-z]{2}$/;
const MIN_STYLE_SCREENSHOTS = 2;

const normalizeLanguage = (value: string | null): string | null => {
  if (value === null) {
    return null;
  }
  const code = value.trim().toLowerCase();
  return LANGUAGE_CODE.test(code) ? code : null;
};

const normalizeCaption = (value: string | null): string | null => {
  if (value === null) {
    return null;
  }
  const text = value.trim().slice(0, MAX_CAPTION_CHARS);
  return text.length === 0 ? null : text;
};

export function parseObservations(
  raw: unknown,
  sent: SentCreative,
): CreativeObservations {
  const parsed = creativeObservationsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AiRequestError(
      'The model returned observations that do not match the schema.',
      true,
    );
  }

  const seen = new Set<number>();
  const screenshots = parsed.data.screenshots
    .filter((item) => {
      if (
        item.position < 1 ||
        item.position > sent.screenshots ||
        seen.has(item.position)
      ) {
        return false;
      }
      seen.add(item.position);
      return true;
    })
    .map((item) => ({
      position: item.position,
      captionText: normalizeCaption(item.captionText),
      captionReadable: item.captionReadable,
      captionLanguage: normalizeLanguage(item.captionLanguage),
      message: item.message,
    }))
    .sort((a, b) => a.position - b.position);

  const icon = parsed.data.icon;
  const similar = icon?.similarCompetitorPosition ?? null;
  return {
    icon:
      icon === null || !sent.icon
        ? null
        : {
            ...icon,
            similarCompetitorPosition:
              similar !== null &&
              similar >= 1 &&
              similar <= sent.competitorIcons
                ? similar
                : null,
          },
    screenshots,
    consistentStyle:
      sent.screenshots >= MIN_STYLE_SCREENSHOTS
        ? parsed.data.consistentStyle
        : null,
  };
}

export const sentCompetitorIcons = (inputs: CreativeInputs): CompetitorIcon[] =>
  inputs.competitorIcons.slice(0, MAX_COMPETITOR_ICONS);

export const analyzedMedia = (inputs: CreativeInputs): AnalyzedMedia => ({
  iconUrl: inputs.iconUrl,
  screenshotUrls: inputs.screenshotUrls.slice(0, MAX_ANALYZED_SCREENSHOTS),
  competitorAppIds: sentCompetitorIcons(inputs).map((icon) => icon.appId),
});

export const toStoredCreative = (
  observations: CreativeObservations,
  inputs: CreativeInputs,
): StoredCreative => ({ ...observations, media: analyzedMedia(inputs) });

export function readStoredCreative(json: unknown): {
  observations: CreativeObservations;
  media: AnalyzedMedia;
} | null {
  const parsed = storedCreativeSchema.safeParse(json);
  if (!parsed.success) {
    return null;
  }
  const { media, ...observations } = parsed.data;
  return { observations, media };
}

export function creativeFingerprint(
  inputs: CreativeInputs,
  model: string,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        CREATIVE_PROMPT_VERSION,
        model,
        inputs.store,
        inputs.country,
        inputs.iconUrl,
        inputs.screenshotUrls.slice(0, MAX_ANALYZED_SCREENSHOTS),
        sentCompetitorIcons(inputs)
          .map((icon) => icon.iconUrl)
          .sort(),
      ]),
    )
    .digest('hex');
}
