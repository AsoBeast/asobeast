import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsString, Matches, MaxLength } from 'class-validator';
import type { PlayConnectionRequest } from '@asobeast/shared';

const BUCKET = /^pubsite_prod(_rev)?_\d+$/;
export const BUCKET_MAX_LENGTH = 63;
export const SERVICE_ACCOUNT_MAX_LENGTH = 16_384;

export class PlayConnectionDto implements PlayConnectionRequest {
  @ApiProperty({ enum: ['GOOGLE_PLAY'] })
  @Equals('GOOGLE_PLAY')
  store!: 'GOOGLE_PLAY';

  @ApiProperty({
    description:
      'The whole contents of the JSON key file Google Cloud downloaded for the service account. Verified with Google, sealed at rest and never returned.',
    maxLength: SERVICE_ACCOUNT_MAX_LENGTH,
  })
  @IsString()
  @MaxLength(SERVICE_ACCOUNT_MAX_LENGTH)
  serviceAccountJson!: string;

  @ApiProperty({
    example: 'pubsite_prod_rev_01234567890987654321',
    description:
      'The Cloud Storage bucket id shown under Download reports in Play Console',
    maxLength: BUCKET_MAX_LENGTH,
  })
  @MaxLength(BUCKET_MAX_LENGTH)
  @Matches(BUCKET, {
    message:
      'bucket must be the pubsite_prod bucket id shown under Download reports in Play Console',
  })
  bucket!: string;
}
