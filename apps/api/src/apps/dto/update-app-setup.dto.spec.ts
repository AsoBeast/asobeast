import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SETUP_MARKETS_MAX } from '@asobeast/shared';
import { UpdateAppSetupDto } from './update-app-setup.dto';

const errorsOf = async (body: Record<string, unknown>) =>
  (
    await validate(plainToInstance(UpdateAppSetupDto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((error) => error.property);

const markets = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    String.fromCharCode(97 + Math.floor(index / 26), 97 + (index % 26)),
  );

describe('UpdateAppSetupDto', () => {
  it.each([
    [{}],
    [{ status: 'dismissed' }],
    [{ skipped: [] }],
    [{ skipped: ['competitors', 'countries'] }],
    [{ countriesReviewed: true }],
    [{ selectedMarkets: markets(SETUP_MARKETS_MAX) }],
    [
      {
        status: 'in_progress',
        skipped: [],
        countriesReviewed: false,
        selectedMarkets: ['us'],
      },
    ],
  ])('accepts %j', async (body) => {
    await expect(errorsOf(body)).resolves.toEqual([]);
  });

  it.each([
    ['an unknown status', { status: 'later' }, 'status'],
    ['a null status', { status: null }, 'status'],
    ['an unknown step', { skipped: ['alerts'] }, 'skipped'],
    ['a repeated step', { skipped: ['keywords', 'keywords'] }, 'skipped'],
    ['steps that are no list', { skipped: 'keywords' }, 'skipped'],
    [
      'a review that is no boolean',
      { countriesReviewed: 'yes' },
      'countriesReviewed',
    ],
    [
      'a market that is no code',
      { selectedMarkets: ['usa'] },
      'selectedMarkets',
    ],
    ['an uppercase market', { selectedMarkets: ['US'] }, 'selectedMarkets'],
    ['no market', { selectedMarkets: [] }, 'selectedMarkets'],
    ['a repeated market', { selectedMarkets: ['us', 'us'] }, 'selectedMarkets'],
    [
      'more markets than the limit',
      { selectedMarkets: markets(SETUP_MARKETS_MAX + 1) },
      'selectedMarkets',
    ],
    [
      'a property it does not know',
      { completedAt: '2026-10-14' },
      'completedAt',
    ],
  ])('refuses %s', async (_case, body, property) => {
    await expect(errorsOf(body)).resolves.toEqual([property]);
  });
});
