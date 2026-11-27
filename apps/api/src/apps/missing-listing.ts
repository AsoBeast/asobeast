import { NotFoundException } from '@nestjs/common';

export class MissingListingError extends NotFoundException {}

export const missingListing = (
  market: string,
  localization: string | null = null,
): MissingListingError =>
  new MissingListingError(
    localization === null
      ? `No listing captured for ${market}`
      : `No ${localization} listing captured for ${market}`,
  );
