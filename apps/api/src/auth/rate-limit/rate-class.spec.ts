import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SPENDS_STORE_CAPACITY_KEY } from '../decorators/spends-store-capacity.decorator';
import { RATE_CLASS_KEY, rateClassOf } from './rate-class';

function contextWith(metadata: Record<string, unknown>): ExecutionContext {
  const handler = () => undefined;
  for (const [key, value] of Object.entries(metadata)) {
    Reflect.defineMetadata(key, value, handler);
  }
  return {
    getHandler: () => handler,
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
}

describe('rateClassOf', () => {
  const reflector = new Reflector();

  it('reads a plain GET from the generous read budget', () => {
    expect(rateClassOf(reflector, contextWith({}), 'GET')).toBe('read');
  });

  it('treats anything that changes state as a write', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(rateClassOf(reflector, contextWith({}), method)).toBe('write');
    }
  });

  it('classifies a store-touching endpoint by its capacity marker', () => {
    const context = contextWith({ [SPENDS_STORE_CAPACITY_KEY]: true });

    expect(rateClassOf(reflector, context, 'GET')).toBe('store');
  });

  it('lets a handler declare a class the method would get wrong', () => {
    const context = contextWith({ [RATE_CLASS_KEY]: 'read' });

    expect(rateClassOf(reflector, context, 'POST')).toBe('read');
  });

  it('keeps the store class ahead of a declared one', () => {
    const context = contextWith({
      [SPENDS_STORE_CAPACITY_KEY]: true,
      [RATE_CLASS_KEY]: 'read',
    });

    expect(rateClassOf(reflector, context, 'GET')).toBe('store');
  });
});
