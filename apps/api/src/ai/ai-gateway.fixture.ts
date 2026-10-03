import { ConflictException } from '@nestjs/common';
import { aiCompletion } from './ai-completion.fixture';
import { AI_NOT_CONFIGURED } from './ai-gateway.service';

const notConfigured = () =>
  Promise.reject(new ConflictException(AI_NOT_CONFIGURED));

export const buildAi = (spend?: jest.Mock, configured = true) => ({
  configured,
  model: configured ? 'gpt-4o' : null,
  requireModel: jest.fn(() => {
    if (!configured) throw new ConflictException(AI_NOT_CONFIGURED);
    return 'gpt-4o';
  }),
  spend:
    spend ??
    jest.fn(() =>
      configured
        ? Promise.resolve(
            aiCompletion({ explanation: '  Your title is missing it.  ' }),
          )
        : notConfigured(),
    ),
  reserve: jest.fn(() =>
    configured ? Promise.resolve('call_1') : notConfigured(),
  ),
  charge: jest.fn(),
  release: jest.fn(() => Promise.resolve()),
});
