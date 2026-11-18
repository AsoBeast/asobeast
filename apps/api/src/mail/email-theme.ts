import { pixelBasedPreset, type TailwindConfig } from 'react-email';

const FONT_STACK = [
  'Geist',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Roboto',
  'Helvetica',
  'Arial',
  'sans-serif',
];

export const EMAIL_TAILWIND: TailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        canvas: '#faf9f7',
        surface: '#ffffff',
        well: '#f4f2ee',
        ink: '#1c1917',
        'ink-2': '#6b665f',
        'ink-3': '#716b64',
        line: '#e7e4df',
        brand: '#f89820',
        'brand-ink': '#1c1408',
        up: '#137a3a',
        down: '#c2272d',
        night: {
          canvas: '#0c0b0a',
          surface: '#141311',
          well: '#1c1a17',
          ink: '#efece7',
          'ink-2': '#a39d94',
          'ink-3': '#8a847b',
          line: '#2a2724',
          up: '#4ade80',
          down: '#f87171',
        },
      },
      fontFamily: { sans: FONT_STACK },
    },
  },
};
