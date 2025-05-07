// src\utils\createZip.test.ts
import { jest } from '@jest/globals';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { createZip } from './createZip.js';

describe('createZip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should zip a file', async () => {
    await fs.mkdir('test', { recursive: true });
    const size = await createZip(path.join('test', 'tsconfig.zip'), 'tsconfig.json');
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a fullpath file', async () => {
    const size = await createZip(path.join('test', 'fulltsconfig.zip'), path.resolve('tsconfig.json'));
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a directory', async () => {
    const size = await createZip(path.join('test', 'docker.zip'), 'docker');
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a fullpath directory', async () => {
    const size = await createZip(path.join('test', 'fulldocker.zip'), path.resolve('docker'));
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a sub directory', async () => {
    const size = await createZip(path.join('test', 'utils.zip'), path.join('src', 'utils'));
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a fullpath sub directory', async () => {
    const size = await createZip(path.join('test', 'fullutils.zip'), path.resolve('src', 'utils'));
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a glob', async () => {
    const size = await createZip(path.join('test', 'glob.zip'), path.join('*.js'));
    expect(size).toBeGreaterThan(0);
  }, 60000);

  it('should zip a full glob path', async () => {
    const size = await createZip(path.join('test', 'fullglob.zip'), path.resolve('*.js'));
    expect(size).toBeGreaterThan(0);
  }, 60000);

  it('should zip a glob with **', async () => {
    const size = await createZip(path.join('test', 'globstars.zip'), path.join('docker', '**', 'Dockerfile.*'));
    expect(size).toBeGreaterThan(0);
  }, 60000);

  it('should zip a full glob path with **', async () => {
    const size = await createZip(path.join('test', 'fullglobstars.zip'), path.resolve('docker', '**', 'Dockerfile.*'));
    expect(size).toBeGreaterThan(0);
  }, 60000);

  it('should zip with an array', async () => {
    const size = await createZip(path.join('test', 'array.zip'), 'package.json', '*.js', path.join('src', 'utils'));
    expect(size).toBeGreaterThan(0);
  }, 60000);
});
