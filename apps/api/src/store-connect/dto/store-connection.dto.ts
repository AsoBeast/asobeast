import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsString, Matches, MaxLength } from 'class-validator';
import type { AppStoreConnectionRequest } from '@asobeast/shared';

const ISSUER_ID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const KEY_ID = /^[A-Za-z0-9]{10}$/;
export const PRIVATE_KEY_MAX_LENGTH = 4_096;

export class StoreConnectionDto implements AppStoreConnectionRequest {
  @ApiProperty({ enum: ['APP_STORE'] })
  @Equals('APP_STORE')
  store!: 'APP_STORE';

  @ApiProperty({
    example: '57246542-96fe-1a63-e053-0824d011072a',
    description: 'Issuer ID from Users and Access, Integrations, Team Keys',
  })
  @Matches(ISSUER_ID, {
    message: 'issuerId must be the issuer ID shown above the team keys',
  })
  issuerId!: string;

  @ApiProperty({ example: '2X9R4HXF34', description: 'Ten character key ID' })
  @Matches(KEY_ID, { message: 'keyId must be the ten character key ID' })
  keyId!: string;

  @ApiProperty({
    description:
      'The whole contents of the downloaded .p8 file. Verified with Apple, sealed at rest and never returned.',
    maxLength: PRIVATE_KEY_MAX_LENGTH,
  })
  @IsString()
  @MaxLength(PRIVATE_KEY_MAX_LENGTH)
  privateKey!: string;
}
