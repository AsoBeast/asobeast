import { CHECKOUT_BRAND, PRODUCT_NAME } from '@asobeast/shared';
import { brandingFor, brandingOf } from './checkout-branding';

describe('brandingOf', () => {
  it.each(['light', 'dark'] as const)(
    'names every field of the %s brand the way stripe reads it',
    (theme) => {
      expect(brandingOf(CHECKOUT_BRAND[theme])).toEqual({
        background_color: CHECKOUT_BRAND[theme].backgroundColor,
        button_color: CHECKOUT_BRAND[theme].buttonColor,
        border_style: 'rounded',
        font_family: 'inter',
        display_name: PRODUCT_NAME,
      });
    },
  );
});

describe('brandingFor', () => {
  it('brands for the theme the page asked for', () => {
    expect(brandingFor('dark')).toEqual(brandingOf(CHECKOUT_BRAND.dark));
  });

  it('brands for the light theme when the page names none', () => {
    expect(brandingFor(undefined)).toEqual(brandingOf(CHECKOUT_BRAND.light));
  });
});
