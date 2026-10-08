import type { AuthInfo } from '@modelcontextprotocol/server';
import { authInfoFor, tokenScopeOf } from './mcp-auth-info';

const info = (scopes: string[]): AuthInfo => ({
  token: '',
  clientId: 'x',
  scopes,
});

describe('the token scope an mcp request carries', () => {
  it.each([
    ['no auth info at all', undefined],
    ['an empty scope list', info([])],
    ['a read scope', info(['read'])],
    ['an unknown scope', info(['admin'])],
    ['a scope with different case', info(['WRITE'])],
  ])('reads as read for %s', (_case, authInfo) => {
    expect(tokenScopeOf(authInfo)).toBe('read');
  });

  it('reads as write only for an explicit write scope', () => {
    expect(tokenScopeOf(info(['write']))).toBe('write');
  });

  it('round trips the scope it was built for', () => {
    expect(tokenScopeOf(authInfoFor('write'))).toBe('write');
    expect(tokenScopeOf(authInfoFor('read'))).toBe('read');
  });

  it('never carries the token itself', () => {
    expect(authInfoFor('write').token).toBe('');
  });
});
