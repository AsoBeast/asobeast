import { AI_PROVIDER_WORDING, aiProviderOf } from './ai-provider';

describe('aiProviderOf', () => {
  it('names OpenAI when no address is configured', () => {
    expect(aiProviderOf(undefined)).toBe('openai');
  });

  it.each([
    'https://api.openai.com/v1',
    'https://eu.api.openai.com/v1',
    'https://us.api.openai.com/v1/',
    'https://southcentralus.privatelink.api.openai.com/v1',
    'https://API.OpenAI.com/v1',
  ])('names OpenAI for its own host %s', (address) => {
    expect(aiProviderOf(address)).toBe('openai');
  });

  it.each([
    'https://openrouter.ai/api/v1',
    'http://localhost:11434/v1',
    'http://host.docker.internal:11434/v1',
    'https://my-resource.openai.azure.com/openai/v1/',
    'https://openai.com.example.net/v1',
    'https://notopenai.com/v1',
    'https://generativelanguage.googleapis.com/v1beta/openai/',
  ])('names a compatible provider for %s', (address) => {
    expect(aiProviderOf(address)).toBe('compatible');
  });
});

describe('AI_PROVIDER_WORDING', () => {
  it('never names OpenAI for a compatible provider', () => {
    expect(JSON.stringify(AI_PROVIDER_WORDING.compatible)).not.toMatch(
      /openai/i,
    );
  });
});
