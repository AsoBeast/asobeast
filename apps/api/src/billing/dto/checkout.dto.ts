import { IsString, MaxLength, MinLength } from 'class-validator';
import type { CheckoutRequest } from '@asobeast/shared';

export class CheckoutDto implements CheckoutRequest {
  @IsString()
  @MinLength(4)
  @MaxLength(255)
  priceId!: string;
}
