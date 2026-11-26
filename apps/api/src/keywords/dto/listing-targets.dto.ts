import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  countMaxLengthChars,
  LISTING_TARGET_LIMIT,
  ListingTargetsRequest,
  TRACKED_KEYWORD_CHAR_LIMIT,
} from '@asobeast/shared';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  ValidateBy,
} from 'class-validator';

const isTargetSlot = (value: unknown): boolean =>
  value === null ||
  (typeof value === 'string' &&
    countMaxLengthChars(value) <= TRACKED_KEYWORD_CHAR_LIMIT);

export class ListingTargetsDto implements ListingTargetsRequest {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', nullable: true },
    maxItems: LISTING_TARGET_LIMIT,
    example: ['habit tracker', 'focus timer', null, 'sleep sounds'],
    description:
      'The target keywords in slot order, null for an empty slot. Slot 1 is meant for the title and slots 2 and 3 for the subtitle.',
  })
  @IsArray()
  @ArrayMaxSize(LISTING_TARGET_LIMIT)
  @ValidateBy(
    {
      name: 'isTargetSlot',
      validator: {
        validate: isTargetSlot,
        defaultMessage: () =>
          `each slot must be null or a phrase of at most ${TRACKED_KEYWORD_CHAR_LIMIT} characters`,
      },
    },
    { each: true },
  )
  slots!: (string | null)[];

  @ApiPropertyOptional({
    description:
      'Track every slot in every market reading the localization that does not track it yet, not only the phrases new to the stored list.',
  })
  @IsOptional()
  @IsBoolean()
  trackMissing?: boolean;
}
