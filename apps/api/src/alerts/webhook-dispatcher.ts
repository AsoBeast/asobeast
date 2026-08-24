import { lookup as dnsLookup } from 'node:dns';
import type { LookupFunction } from 'node:net';
import { Agent, buildConnector, type Dispatcher } from 'undici';
import { WebhookTargetError, isBlockedAddress } from './webhook-target';
import type { WebhookTargetOptions } from './webhook-target';

const CONNECT_TIMEOUT_MS = 5_000;

const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) {
      callback(error, []);
      return;
    }
    const allowed = addresses.filter(
      (entry) => !isBlockedAddress(entry.address),
    );
    if (allowed.length === 0) {
      callback(
        new WebhookTargetError(
          `${hostname} resolves only to private or reserved addresses`,
        ),
        [],
      );
      return;
    }
    if (options.all) {
      callback(null, allowed);
      return;
    }
    callback(null, allowed[0].address, allowed[0].family);
  });
};

export function publicOnlyDispatcher(
  options: WebhookTargetOptions = {},
): Dispatcher {
  if (options.allowPrivate) {
    return new Agent({ connect: { timeout: CONNECT_TIMEOUT_MS } });
  }

  const connect = buildConnector({
    timeout: CONNECT_TIMEOUT_MS,
    lookup: publicOnlyLookup,
  });

  return new Agent({
    connect(connectOptions, callback) {
      connect(connectOptions, (error, socket) => {
        if (error || !socket) {
          callback(error ?? new WebhookTargetError('connection failed'), null);
          return;
        }
        const peer = socket.remoteAddress;
        if (peer === undefined || isBlockedAddress(peer)) {
          socket.destroy();
          callback(
            new WebhookTargetError(
              `${connectOptions.hostname} connected to the private address ${peer ?? 'unknown'}`,
            ),
            null,
          );
          return;
        }
        callback(null, socket);
      });
    },
  });
}
