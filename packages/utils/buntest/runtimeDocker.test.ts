/**
 * @file packages/utils/buntest/runtimeDocker.test.ts
 * @description This file contains the tests for runtimeDocker.
 * @author Luca Liguori
 */

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { setupTest } from '@matterbridge/test-utils/buntest/setup';

import { DOCKER_MARKER_FILES, isDocker } from '../src/runtimeDocker.js';

// Setup the test environment
await setupTest('RuntimeDocker', false);

const originalPlatform = process.platform;
const originalRemoteContainers = process.env.REMOTE_CONTAINERS;
const originalCodespaces = process.env.CODESPACES;
const tempDir = mkdtempSync(path.join(os.tmpdir(), 'matterbridge-runtime-docker-'));
const markerFile = path.join(tempDir, '.dockerenv');
const missingFile = path.join(tempDir, 'missing');
writeFileSync(markerFile, '');

/**
 * Restores an environment variable to its original value.
 *
 * @param {string} name - The environment variable name.
 * @param {string | undefined} value - The original value, or undefined to delete it.
 */
function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) Reflect.deleteProperty(process.env, name);
  else process.env[name] = value;
}

beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  delete process.env.REMOTE_CONTAINERS;
  delete process.env.CODESPACES;
});

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: originalPlatform });
  restoreEnv('REMOTE_CONTAINERS', originalRemoteContainers);
  restoreEnv('CODESPACES', originalCodespaces);
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('isDocker()', () => {
  it('should look for the Docker and Podman marker files by default', () => {
    expect(DOCKER_MARKER_FILES).toEqual(['/.dockerenv', '/run/.containerenv']);
  });

  it('should return true on Linux when a marker file exists', () => {
    expect(isDocker([missingFile, markerFile])).toBe(true);
  });

  it('should return false on Linux when no marker file exists and no container variable is set', () => {
    expect(isDocker([missingFile])).toBe(false);
  });

  it.each(['REMOTE_CONTAINERS', 'CODESPACES'])('should return true on Linux when %s is true', (name) => {
    process.env[name] = 'true';

    expect(isDocker([missingFile])).toBe(true);
  });

  it.each(['darwin', 'win32'])('should return false on %s even when a marker file exists or a container variable is set', (platform) => {
    Object.defineProperty(process, 'platform', { value: platform });
    process.env.REMOTE_CONTAINERS = 'true';

    expect(isDocker([markerFile])).toBe(false);
  });

  it('should use the default marker files when none are passed', () => {
    expect(typeof isDocker()).toBe('boolean');
  });
});
