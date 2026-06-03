/**
 * @description Tests for WsMessage type guards in frontendTypes.
 * @file frontendTypes.test.ts
 * @author Luca Liguori
 * @created 2026-05-31
 * @version 1.0.0
 * @license Apache-2.0
 */

import { jest } from '@jest/globals';

import type { WsMessage } from './frontendTypes.js';
import { isApiRequest, isApiResponse, isBroadcast } from './frontendTypes.js';

describe('WsMessage type guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  const request: WsMessage = { id: 1, src: 'Frontend', dst: 'Matterbridge', method: 'ping' };
  const response: WsMessage = { id: 1, src: 'Matterbridge', dst: 'Frontend', method: 'pong' };
  const broadcast: WsMessage = { id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'log' };

  describe('isApiRequest', () => {
    test('should return true when id is non-zero, src is Frontend, and dst is Matterbridge', () => {
      expect(isApiRequest(request)).toBe(true);
    });

    test('should return false when id is 0', () => {
      expect(isApiRequest({ ...request, id: 0 })).toBe(false);
    });

    test('should return false when src is not Frontend', () => {
      expect(isApiRequest({ ...request, src: 'Matterbridge' })).toBe(false);
    });

    test('should return false when dst is not Matterbridge', () => {
      expect(isApiRequest({ ...request, dst: 'Frontend' })).toBe(false);
    });

    test('should return false for a response message', () => {
      expect(isApiRequest(response)).toBe(false);
    });

    test('should return false for a broadcast message', () => {
      expect(isApiRequest(broadcast)).toBe(false);
    });
  });

  describe('isApiResponse', () => {
    test('should return true when id is non-zero, src is Matterbridge, and dst is Frontend', () => {
      expect(isApiResponse(response)).toBe(true);
    });

    test('should return false when id is 0', () => {
      expect(isApiResponse({ ...response, id: 0 })).toBe(false);
    });

    test('should return false when src is not Matterbridge', () => {
      expect(isApiResponse({ ...response, src: 'Frontend' })).toBe(false);
    });

    test('should return false when dst is not Frontend', () => {
      expect(isApiResponse({ ...response, dst: 'Matterbridge' })).toBe(false);
    });

    test('should return false for a request message', () => {
      expect(isApiResponse(request)).toBe(false);
    });

    test('should return false for a broadcast message', () => {
      expect(isApiResponse(broadcast)).toBe(false);
    });
  });

  describe('isBroadcast', () => {
    test('should return true when id is 0, src is Matterbridge, and dst is Frontend', () => {
      expect(isBroadcast(broadcast)).toBe(true);
    });

    test('should return false when id is non-zero', () => {
      expect(isBroadcast({ ...broadcast, id: 1 })).toBe(false);
    });

    test('should return false when src is not Matterbridge', () => {
      expect(isBroadcast({ ...broadcast, src: 'Frontend' })).toBe(false);
    });

    test('should return false when dst is not Frontend', () => {
      expect(isBroadcast({ ...broadcast, dst: 'Matterbridge' })).toBe(false);
    });

    test('should return false for a request message', () => {
      expect(isBroadcast(request)).toBe(false);
    });

    test('should return false for a response message', () => {
      expect(isBroadcast(response)).toBe(false);
    });
  });
});
