import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  CHECKOUT_THEMES,
  CHECKOUT_UIS,
  type CheckoutRequest,
  type CheckoutTheme,
  type CheckoutUi,
} from '@asobeast/shared';

export class CheckoutDto implements CheckoutRequest {
  @IsString()
  @MinLength(4)
  @MaxLength(255)
  priceId!: string;

  @IsOptional()
  @IsIn(CHECKOUT_UIS)
  ui?: CheckoutUi;

  @IsOptional()
  @IsIn(CHECKOUT_THEMES)
  theme?: CheckoutTheme;
}
