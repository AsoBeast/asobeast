import { pixelBasedPreset, type TailwindConfig } from 'react-email';

const FONT_STACK = [
  'IBM Plex Sans',
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
        canvas: '#f4f2ef',
        surface: '#ffffff',
        well: '#fbfaf8',
        ink: '#110f0c',
        body: '#4b4742',
        muted: '#69655f',
        line: '#e6e4e1',
        brand: '#f89820',
        'brand-ink': '#a24e10',
        up: '#0d7a3e',
        down: '#c12535',
        night: {
          canvas: '#110f0c',
          surface: '#1b1815',
          well: '#26231f',
          ink: '#fbfaf8',
          body: '#d3d0cc',
          muted: '#aeaba6',
          line: '#322e2a',
          up: '#4eca7a',
          down: '#f66c6d',
        },
      },
      fontFamily: { sans: FONT_STACK },
    },
  },
};
