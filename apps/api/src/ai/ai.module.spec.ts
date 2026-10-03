import { AiGateway } from './ai-gateway.service';
import { AiModule } from './ai.module';

describe('AiModule', () => {
  it('exports the gateway and keeps the openai client private', () => {
    const exported: unknown = Reflect.getMetadata('exports', AiModule);
    expect(exported).toEqual([AiGateway]);
  });
});
