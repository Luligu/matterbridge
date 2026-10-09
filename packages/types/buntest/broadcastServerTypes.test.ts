/**
 * @file packages/types/buntest/broadcastServerTypes.test.ts
 * @description Type-level tests for the worker message types in broadcastServerTypes.
 * @author Luca Liguori
 */

import { describe, expect, expectTypeOf, test } from 'bun:test';

import type {
  WorkerMessage,
  WorkerMessageRequest,
  WorkerMessageResponse,
  WorkerMessageResponseError,
  WorkerMessageResponseErrorForRequest,
  WorkerMessageResponseSuccess,
  WorkerMessageResponseSuccessForRequest,
  WorkerMessageTypes,
} from '../src/broadcastServerTypes.js';

// broadcastServerTypes.ts declares types only and compiles to an empty module, so these assertions are
// enforced by `npm run typecheck`; the runtime expectations only check that the sample messages are built as typed.

describe('broadcastServerTypes', () => {
  describe('WorkerMessageRequest', () => {
    test('should require params when the request declares them', () => {
      const request: WorkerMessageRequest<'test'> = { type: 'test', src: 'manager', dst: 'matterbridge', params: { userId: 1 } };

      expectTypeOf(request.params).toEqualTypeOf<{ userId: number }>();
      // @ts-expect-error params is required for the 'test' request
      const missing: WorkerMessageRequest<'test'> = { type: 'test', src: 'manager', dst: 'matterbridge' };
      expect(request.params.userId).toBe(1);
      expect(missing.type).toBe('test');
    });

    test('should make params optional and undefined when the request declares none', () => {
      const request: WorkerMessageRequest<'test_simple'> = { type: 'test_simple', src: 'manager', dst: 'all' };

      expectTypeOf(request.params).toEqualTypeOf<undefined>();
      expect(request.params).toBeUndefined();
    });

    test('should accept the optional id and timestamp fields', () => {
      const request: WorkerMessageRequest<'test_simple'> = { type: 'test_simple', id: 7, timestamp: 1000, src: 'frontend', dst: 'matter' };

      expectTypeOf(request.id).toEqualTypeOf<number | undefined>();
      expectTypeOf(request.timestamp).toEqualTypeOf<number | undefined>();
      expect(request).toEqual({ type: 'test_simple', id: 7, timestamp: 1000, src: 'frontend', dst: 'matter' });
    });

    test('should reject a broadcast source', () => {
      // @ts-expect-error 'all' is a valid destination but not a valid source
      const request: WorkerMessageRequest<'test_simple'> = { type: 'test_simple', src: 'all', dst: 'manager' };
      expect<string>(request.src).toBe('all');
    });
  });

  describe('WorkerMessageResponse', () => {
    test('should carry the result on success', () => {
      const response: WorkerMessageResponseSuccess<'test'> = { type: 'test', src: 'matterbridge', dst: 'manager', elapsed: 5, result: { name: 'Luca', age: 1 } };

      expectTypeOf(response.result).toEqualTypeOf<{ name: string; age: number }>();
      expectTypeOf(response.error).toEqualTypeOf<undefined>();
      expect(response.result.name).toBe('Luca');
    });

    test('should carry only the error on failure', () => {
      const response: WorkerMessageResponseError<'test'> = { type: 'test', src: 'matterbridge', dst: 'manager', error: 'Failed' };

      expectTypeOf(response.error).toEqualTypeOf<string>();
      expectTypeOf(response.result).toEqualTypeOf<undefined>();
      expect(response.error).toBe('Failed');
    });

    test('should not allow result and error together', () => {
      // @ts-expect-error a response is either a success or an error
      const response: WorkerMessageResponse<'test'> = { type: 'test', src: 'matterbridge', dst: 'manager', result: { name: 'Luca', age: 1 }, error: 'Failed' };
      expect(response.type).toBe('test');
    });

    test('should accept either a success or an error', () => {
      expectTypeOf<WorkerMessageResponseSuccess<'test'>>().toExtend<WorkerMessageResponse<'test'>>();
      expectTypeOf<WorkerMessageResponseError<'test'>>().toExtend<WorkerMessageResponse<'test'>>();
    });
  });

  describe('request-derived responses', () => {
    test('should resolve the success and error responses from a request type', () => {
      type Request = WorkerMessageRequest<'get_log_level'>;

      expectTypeOf<WorkerMessageResponseSuccessForRequest<Request>>().toEqualTypeOf<WorkerMessageResponseSuccess<'get_log_level'>>();
      expectTypeOf<WorkerMessageResponseErrorForRequest<Request>>().toEqualTypeOf<WorkerMessageResponseError<'get_log_level'>>();
    });
  });

  describe('WorkerMessage', () => {
    test('should include requests and responses of the same type', () => {
      expectTypeOf<WorkerMessageRequest<'test'>>().toExtend<WorkerMessage<'test'>>();
      expectTypeOf<WorkerMessageResponse<'test'>>().toExtend<WorkerMessage<'test'>>();
      expectTypeOf<WorkerMessage<'test'>['type']>().toEqualTypeOf<'test'>();
    });

    test('should key every message by a WorkerMessageTypes entry', () => {
      expectTypeOf<WorkerMessage['type']>().toEqualTypeOf<keyof WorkerMessageTypes>();
    });
  });
});
