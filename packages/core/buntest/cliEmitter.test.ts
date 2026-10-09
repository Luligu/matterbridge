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
    cliEmitter.once('cpu', listener);
    cliEmitter.once('memory', listener);
    cliEmitter.once('uptime', listener);

    cliEmitter.emit('ready');
    cliEmitter.emit('shutdown');
    cliEmitter.emit('cpu', 12.5, 3.25);
    cliEmitter.emit('memory', '2 GB', '1 GB', '512 MB', '256 MB', '128 MB', '64 MB', '32 MB');
    cliEmitter.emit('uptime', '1 hour', '1 minute');

    expect(listener.mock.calls).toEqual([[], [], [12.5, 3.25], ['2 GB', '1 GB', '512 MB', '256 MB', '128 MB', '64 MB', '32 MB'], ['1 hour', '1 minute']]);
    expect(cliEmitter.eventNames()).toEqual([]);
  });
});
