import { NotFoundException } from '@nestjs/common';

export const missingListing = (
  market: string,
  localization: string | null = null,
): NotFoundException =>
  new NotFoundException(
    localization === null
      ? `No listing captured for ${market}`
      : `No ${localization} listing captured for ${market}`,
  );
