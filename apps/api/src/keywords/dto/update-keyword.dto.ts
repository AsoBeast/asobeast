import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  isKeywordTag,
  KEYWORD_NOTE_MAX_LENGTH,
  KEYWORD_TAG_MAX_LENGTH,
  KEYWORD_TAGS_MAX,
  KeywordUpdateRequest,
  normalizeKeywordNote,
  normalizeKeywordTags,
} from '@asobeast/shared';

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

@ValidatorConstraint({ name: 'keywordTag' })
class KeywordTagConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isKeywordTag(value);
  }

  defaultMessage(): string {
    return `each tag is at most ${KEYWORD_TAG_MAX_LENGTH} letters, numbers, spaces, hyphens or underscores and starts with a letter or number`;
  }
}

export class UpdateKeywordDto implements KeywordUpdateRequest {
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    example: 80,
    minimum: 1,
    maximum: 100,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(100)
  relevance?: number | null;

  @ApiPropertyOptional({
    example: ['core', 'brand'],
    maxItems: KEYWORD_TAGS_MAX,
    type: [String],
  })
  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    isStringList(value) ? normalizeKeywordTags(value) : value,
  )
  @IsArray()
  @ArrayMaxSize(KEYWORD_TAGS_MAX)
  @IsString({ each: true })
  @Validate(KeywordTagConstraint, { each: true })
  tags?: string[];

  @ApiPropertyOptional({
    example: 'Seasonal, push in May',
    maxLength: KEYWORD_NOTE_MAX_LENGTH,
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeKeywordNote(value) : value,
  )
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(KEYWORD_NOTE_MAX_LENGTH)
  note?: string | null;
}
