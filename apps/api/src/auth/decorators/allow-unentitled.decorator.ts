import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNENTITLED_KEY = 'auth:allowUnentitled';

export const AllowUnentitled = () => SetMetadata(ALLOW_UNENTITLED_KEY, true);
