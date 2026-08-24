export interface ErrorTrackingTarget {
  envelopeUrl: string;
  publicKey: string;
  projectId: string;
}

export class InvalidErrorTrackingDsnError extends Error {
  constructor(reason: string) {
    super(`ERROR_TRACKING_DSN is not a usable dsn: ${reason}`);
    this.name = 'InvalidErrorTrackingDsnError';
  }
}

export function parseErrorTrackingDsn(dsn: string): ErrorTrackingTarget {
  const url = safeUrl(dsn);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new InvalidErrorTrackingDsnError('only http and https are supported');
  }
  if (!url.username) {
    throw new InvalidErrorTrackingDsnError('it carries no public key');
  }

  const projectId = url.pathname.split('/').filter(Boolean).pop();
  if (!projectId) {
    throw new InvalidErrorTrackingDsnError('it carries no project id');
  }

  const prefix = url.pathname.split('/').filter(Boolean).slice(0, -1).join('/');
  const path = prefix ? `/${prefix}` : '';

  return {
    envelopeUrl: `${url.protocol}//${url.host}${path}/api/${projectId}/envelope/`,
    publicKey: url.username,
    projectId,
  };
}

function safeUrl(dsn: string): URL {
  try {
    return new URL(dsn);
  } catch {
    throw new InvalidErrorTrackingDsnError('it is not a url');
  }
}
