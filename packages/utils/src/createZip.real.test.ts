// src\utils\createZip.test.ts

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { jest } from '@jest/globals';
import { HOMEDIR, setupTest } from '@matterbridge/jest-utils';

import { createZip } from './createZip.js';

// Setup the test environment
await setupTest('CreateZipReal', false);

describe('createZip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should zip a file', async () => {
    await fs.mkdir(HOMEDIR, { recursive: true });
    const size = await createZip(path.join(HOMEDIR, 'tsconfig.zip'), 'tsconfig.json');
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a fullpath file', async () => {
    const size = await createZip(path.join(HOMEDIR, 'fulltsconfig.zip'), path.resolve('tsconfig.json'));
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a directory', async () => {
    const size = await createZip(path.join(HOMEDIR, 'docker.zip'), 'docker');
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a fullpath directory', async () => {
    const size = await createZip(path.join(HOMEDIR, 'fulldocker.zip'), path.resolve('docker'));
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a sub directory', async () => {
    const size = await createZip(path.join(HOMEDIR, 'utils.zip'), path.join('src', 'utils'));
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a fullpath sub directory', async () => {
    const size = await createZip(path.join(HOMEDIR, 'fullutils.zip'), path.resolve('src', 'utils'));
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a glob', async () => {
    const size = await createZip(path.join(HOMEDIR, 'glob.zip'), path.join('*.js'));
    expect(size).toBeGreaterThan(0);
  }, 60000);

  it('should zip a full glob path', async () => {
    const size = await createZip(path.join(HOMEDIR, 'fullglob.zip'), path.resolve('*.js'));
    expect(size).toBeGreaterThan(0);
  }, 60000);

  it('should zip a glob with **', async () => {
    const size = await createZip(path.join(HOMEDIR, 'globstars.zip'), path.join('docker', '**', 'Dockerfile.*'));
    expect(size).toBeGreaterThan(0);
  }, 60000);

  it('should zip a full glob path with **', async () => {
    const size = await createZip(path.join(HOMEDIR, 'fullglobstars.zip'), path.resolve('docker', '**', 'Dockerfile.*'));
    expect(size).toBeGreaterThan(0);
  }, 60000);

  it('should zip with an array', async () => {
    const size = await createZip(path.join(HOMEDIR, 'array.zip'), 'package.json', '*.js', path.join('src', 'utils'));
    expect(size).toBeGreaterThan(0);
  }, 60000);
});
