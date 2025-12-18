// src\utils\createZip.test.ts

const NAME = 'CreateZipReal';

const TEST_DIR = path.join('jest', 'CreateZipReal');

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { jest } from '@jest/globals';

import { setupTest } from '../jestutils/jestHelpers.js';

import { createZip } from './createZip.js';

// Setup the test environment
await setupTest(NAME, false);

describe('createZip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should zip a file', async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    const size = await createZip(path.join(TEST_DIR, 'tsconfig.zip'), 'tsconfig.json');
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a fullpath file', async () => {
    const size = await createZip(path.join(TEST_DIR, 'fulltsconfig.zip'), path.resolve('tsconfig.json'));
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a directory', async () => {
    const size = await createZip(path.join(TEST_DIR, 'docker.zip'), 'docker');
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a fullpath directory', async () => {
    const size = await createZip(path.join(TEST_DIR, 'fulldocker.zip'), path.resolve('docker'));
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a sub directory', async () => {
    const size = await createZip(path.join(TEST_DIR, 'utils.zip'), path.join('src', 'utils'));
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a fullpath sub directory', async () => {
    const size = await createZip(path.join(TEST_DIR, 'fullutils.zip'), path.resolve('src', 'utils'));
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a glob', async () => {
    const size = await createZip(path.join(TEST_DIR, 'glob.zip'), path.join('*.js'));
    expect(size).toBeGreaterThan(0);
  }, 60000);

  it('should zip a full glob path', async () => {
    const size = await createZip(path.join(TEST_DIR, 'fullglob.zip'), path.resolve('*.js'));
    expect(size).toBeGreaterThan(0);
  }, 60000);

  it('should zip a glob with **', async () => {
    const size = await createZip(path.join(TEST_DIR, 'globstars.zip'), path.join('docker', '**', 'Dockerfile.*'));
    expect(size).toBeGreaterThan(0);
  }, 60000);

  it('should zip a full glob path with **', async () => {
    const size = await createZip(path.join(TEST_DIR, 'fullglobstars.zip'), path.resolve('docker', '**', 'Dockerfile.*'));
    expect(size).toBeGreaterThan(0);
  }, 60000);

  it('should zip with an array', async () => {
    const size = await createZip(path.join(TEST_DIR, 'array.zip'), 'package.json', '*.js', path.join('src', 'utils'));
    expect(size).toBeGreaterThan(0);
  }, 60000);
});
