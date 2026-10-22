import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  ANNOTATION_LABEL_MAX_LENGTH,
  ANNOTATION_TAG_RULE,
  AppAnnotationCreateRequest,
  COUNTRY_PATTERN,
  isAnnotationTag,
  isUtcCalendarDate,
  normalizeAnnotationLabel,
  normalizeAnnotationTag,
} from '@asobeast/shared';

@ValidatorConstraint({ name: 'annotationDate' })
class AnnotationDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isUtcCalendarDate(value);
  }

  defaultMessage(): string {
    return 'date must be a real UTC day in YYYY-MM-DD form';
  }
}

@ValidatorConstraint({ name: 'annotationTag' })
class AnnotationTagConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isAnnotationTag(value);
  }

  defaultMessage(): string {
    return `tag is ${ANNOTATION_TAG_RULE}`;
  }
}

export class CreateAnnotationDto implements AppAnnotationCreateRequest {
  @ApiProperty({ example: '2026-10-08' })
  @Validate(AnnotationDateConstraint)
  date!: string;

  @ApiProperty({
    example: 'Release 5.21.0',
    maxLength: ANNOTATION_LABEL_MAX_LENGTH,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeAnnotationLabel(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(ANNOTATION_LABEL_MAX_LENGTH)
  label!: string;

  @ApiPropertyOptional({ example: 'de', pattern: COUNTRY_PATTERN.source })
  @ValidateIf((_, value) => value !== undefined)
  @Matches(COUNTRY_PATTERN)
  market?: string;

  @ApiPropertyOptional({ example: 'wave' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeAnnotationTag(value) : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Validate(AnnotationTagConstraint)
  tag?: string;
}
