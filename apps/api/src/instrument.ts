import * as Sentry from '@sentry/nestjs';
import { reportingOptions } from './observability/error-reporting';

const options = reportingOptions(process.env);
if (options) Sentry.init(options);
