import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateActionDto } from './update-action.dto';

async function snoozeErrors(snoozedUntil: string): Promise<string[]> {
  const errors = await validate(
    plainToInstance(UpdateActionDto, { status: 'SNOOZED', snoozedUntil }),
  );
  return errors.map((error) => error.property);
}

describe('UpdateActionDto', () => {
  it.each(['2026-02-30', '2026-11-31', '2026-11-31T00:00:00.000Z'])(
    'refuses a snooze until %s, which is not on the calendar',
    async (snoozedUntil) => {
      await expect(snoozeErrors(snoozedUntil)).resolves.toEqual([
        'snoozedUntil',
      ]);
    },
  );

  it.each(['2028-02-29', '2026-11-30T00:00:00.000Z'])(
    'accepts a snooze until %s',
    async (snoozedUntil) => {
      await expect(snoozeErrors(snoozedUntil)).resolves.toEqual([]);
    },
  );
});
