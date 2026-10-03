import { ConflictException } from '@nestjs/common';
import { aiCompletion } from './ai-completion.fixture';
import { AI_NOT_CONFIGURED } from './ai-gateway.service';

export const buildAi = (
  spend: jest.Mock = jest.fn(() =>
    Promise.resolve(
      aiCompletion({ explanation: '  Your title is missing it.  ' }),
    ),
  ),
  configured = true,
) => ({
  configured,
  model: configured ? 'gpt-4o' : null,
  requireModel: jest.fn(() => {
    if (!configured) throw new ConflictException(AI_NOT_CONFIGURED);
    return 'gpt-4o';
  }),
  spend,
});
