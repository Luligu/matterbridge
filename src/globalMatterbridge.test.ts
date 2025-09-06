// src\globalMatterbridge.test.ts

import type { AnsiLogger } from 'node-ansi-logger';

import { setGlobalMatterbridge, getGlobalMatterbridge, getGlobalFrontend, getGlobalLog } from './globalMatterbridge.js';
import type { Matterbridge } from './matterbridge.js';
import type { Frontend } from './frontend.js';

describe('globalMatterbridge', () => {
  afterEach(() => {
    // Reset globals after each test
    globalThis.__matterbridge__ = undefined;
    globalThis.__frontend__ = undefined;
    globalThis.__log__ = undefined;
  });

  it('throws if getGlobalMatterbridge is called before set', () => {
    expect(() => getGlobalMatterbridge()).toThrow('Global Matterbridge instance is not set.');
  });

  it('throws if getGlobalFrontend is called before set', () => {
    expect(() => getGlobalFrontend()).toThrow('Global Frontend instance is not set.');
  });

  it('throws if getGlobalLog is called before set', () => {
    expect(() => getGlobalLog()).toThrow('Global Logger instance is not set.');
  });

  it('returns the correct instances after setGlobalMatterbridge', () => {
    // Create mock objects
    const mockFrontend = {} as Frontend;
    const mockLog = {} as AnsiLogger;
    const mockMatterbridge = { frontend: mockFrontend, log: mockLog } as unknown as Matterbridge;

    setGlobalMatterbridge(mockMatterbridge);

    expect(getGlobalMatterbridge()).toBe(mockMatterbridge);
    expect(getGlobalFrontend()).toBe(mockFrontend);
    expect(getGlobalLog()).toBe(mockLog);
  });
});
