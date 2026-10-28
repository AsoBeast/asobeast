import type Stripe from 'stripe';
import {
  CHECKOUT_BRAND,
  type CheckoutBrand,
  type CheckoutTheme,
} from '@asobeast/shared';

type BrandingSettings = Stripe.Checkout.SessionCreateParams.BrandingSettings;

export function brandingOf(brand: CheckoutBrand): BrandingSettings {
  return {
    background_color: brand.backgroundColor,
    button_color: brand.buttonColor,
    border_style: brand.borderStyle,
    font_family: brand.fontFamily,
    display_name: brand.displayName,
  };
}

export function brandingFor(
  theme: CheckoutTheme | undefined,
): BrandingSettings {
  return brandingOf(CHECKOUT_BRAND[theme ?? 'light']);
}
