/**
 * @file packages/core/buntest/cliEmitter.test.ts
 * @description This file contains the bun tests for cliEmitter.
 * @author Luca Liguori
 */

import { afterAll, describe, expect, test, vi } from 'bun:test';
import { EventEmitter } from 'node:events';

import { resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';

import { cliEmitter } from '../src/cliEmitter.js';

// Setup the test environment
await setupTest('CliEmitter', false);

describe('cliEmitter', () => {
  afterAll(() => {
    cliEmitter.removeAllListeners();
    resetTest();
  });

  test('should be an instance of EventEmitter', () => {
    expect(cliEmitter).toBeInstanceOf(EventEmitter);
  });

  test('should deliver the events with their arguments', () => {
    const listener = vi.fn();
    cliEmitter.once('ready', listener);
    cliEmitter.once('shutdown', listener);

    cliEmitter.emit('ready');
    cliEmitter.emit('shutdown');

    expect(listener.mock.calls).toEqual([[], []]);
    expect(cliEmitter.eventNames()).toEqual([]);
  });
});
