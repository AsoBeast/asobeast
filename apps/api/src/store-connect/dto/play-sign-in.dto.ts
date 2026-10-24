import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import type { PlaySignInCompletion, PlaySignInRequest } from '@asobeast/shared';
import {
  BUCKET,
  BUCKET_MAX_LENGTH,
  BUCKET_MESSAGE,
} from './play-connection.dto';

export const SIGN_IN_CODE_MAX_LENGTH = 2048;
export const SIGN_IN_STATE_MAX_LENGTH = 4096;

export class PlaySignInDto implements PlaySignInRequest {
  @ApiProperty({
    example: 'pubsite_prod_rev_01234567890987654321',
    description:
      'The Cloud Storage bucket id shown under Download reports in Play Console. Carried through the Google sign in and stored with the connection.',
    maxLength: BUCKET_MAX_LENGTH,
  })
  @IsString()
  @MaxLength(BUCKET_MAX_LENGTH)
  @Matches(BUCKET, { message: BUCKET_MESSAGE })
  bucket!: string;
}

export class PlaySignInCompletionDto implements PlaySignInCompletion {
  @ApiProperty({
    description:
      'The code Google added to the redirect. Redeemed once with Google and never stored.',
    maxLength: SIGN_IN_CODE_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(SIGN_IN_CODE_MAX_LENGTH)
  code!: string;

  @ApiProperty({
    description:
      'The state Google returned unchanged. Opens only for the signed in owner who started the sign in, within ten minutes.',
    maxLength: SIGN_IN_STATE_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(SIGN_IN_STATE_MAX_LENGTH)
  state!: string;
}
