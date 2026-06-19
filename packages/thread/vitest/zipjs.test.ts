import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { loggerInfoSpy, setupTest } from '@matterbridge/vitest-utils';
import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js';

import { createZip, readZip, unZip } from '../src/zipjs.js';

const execFileAsync = promisify(execFile);
const tempDirectories: string[] = [];

await setupTest('ZipJs', false);

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'matterbridge-zipjs-'));
  tempDirectories.push(directory);
  return directory;
}

async function createArchive(zipPath: string, entries: Array<{ filename: string; content?: string; directory?: boolean }>): Promise<void> {
  const writer = new ZipWriter(new Uint8ArrayWriter());

  for (const entry of entries) {
    if (entry.directory) {
      await writer.add(entry.filename, undefined, { directory: true, level: 0 });
      continue;
    }

    await writer.add(entry.filename, new Uint8ArrayReader(new TextEncoder().encode(entry.content ?? '')), { level: 0 });
  }

  await writeFile(zipPath, await writer.close());
}

describe('zipjs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await Promise.all(tempDirectories.map(async (directory) => rm(directory, { recursive: true, force: true })));
    vi.restoreAllMocks();
  });

  test('creates, reads and extracts a zip archive', async () => {
    const tempDirectory = await createTempDirectory();
    const sourceDirectory = path.join(tempDirectory, 'source');
    const nestedDirectory = path.join(sourceDirectory, 'nested');
    const standaloneFile = path.join(tempDirectory, 'standalone.txt');
    const zipPath = path.join(tempDirectory, 'archive.zip');

    await mkdir(nestedDirectory, { recursive: true });
    await writeFile(path.join(sourceDirectory, 'root.txt'), 'root-content');
    await writeFile(path.join(nestedDirectory, 'child.txt'), 'child-content');
    await writeFile(standaloneFile, 'standalone-content');

    const byteLength = await createZip(zipPath, [sourceDirectory, standaloneFile]);

    expect(byteLength).toBeGreaterThan(0);
    expect((await stat(zipPath)).size).toBe(byteLength);

    const content = await readZip(zipPath);

    expect(content.map((entry) => entry.filename)).toEqual(['source/', 'source/nested/', 'source/nested/child.txt', 'source/root.txt', 'standalone.txt']);
    expect(content.filter((entry) => entry.directory)).toHaveLength(2);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining(`Created zip ${zipPath}`));
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('source/'));
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('standalone.txt'));

    const extractedDirectory = await unZip(zipPath);

    expect(extractedDirectory).toBe(path.join(tempDirectory, 'archive'));
    await expect(readFile(path.join(extractedDirectory, 'source', 'root.txt'), 'utf-8')).resolves.toBe('root-content');
    await expect(readFile(path.join(extractedDirectory, 'source', 'nested', 'child.txt'), 'utf-8')).resolves.toBe('child-content');
    await expect(readFile(path.join(extractedDirectory, 'standalone.txt'), 'utf-8')).resolves.toBe('standalone-content');
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining(`Extracted 5 entries from ${zipPath} to ${extractedDirectory}.`));
  });

  test('reads an empty zip archive', async () => {
    const tempDirectory = await createTempDirectory();
    const zipPath = path.join(tempDirectory, 'empty.zip');

    await createArchive(zipPath, []);

    await expect(readZip(zipPath)).resolves.toEqual([]);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining(`Zip ${zipPath} is empty.`));
  });

  test('rejects createZip when no sources are provided', async () => {
    const tempDirectory = await createTempDirectory();

    await expect(createZip(path.join(tempDirectory, 'empty.zip'), [])).rejects.toThrow('No files or directories provided to createZip.');
  });

  test('rejects zip entries that escape the destination directory and normalizes backslashes', async () => {
    const tempDirectory = await createTempDirectory();
    const safeZipPath = path.join(tempDirectory, 'windows.zip');
    const traversalZipPath = path.join(tempDirectory, 'traversal.zip');
    const customDestination = path.join(tempDirectory, 'custom-destination');

    await createArchive(safeZipPath, [{ filename: 'folder\\child.txt', content: 'windows-content' }]);
    await createArchive(traversalZipPath, [{ filename: '..\\escape.txt', content: 'escape-content' }]);

    await expect(unZip(safeZipPath, customDestination)).resolves.toBe(customDestination);
    await expect(readFile(path.join(customDestination, 'folder', 'child.txt'), 'utf-8')).resolves.toBe('windows-content');

    await expect(unZip(traversalZipPath, path.join(tempDirectory, 'traversal'))).rejects.toThrow('Refusing to extract zip entry outside destination: ..\\escape.txt');
  });

  test('rejects unsupported source path types when stat is neither file nor directory', async () => {
    const tempDirectory = await createTempDirectory();
    const sourcePath = path.join(tempDirectory, 'unsupported-source');
    const actualFsPromises = await vi.importActual('node:fs/promises');
    const unsupportedStats = {
      isDirectory: () => false,
      isFile: () => false,
      mtime: new Date(),
    } as any;
    const mockedFsPromises = {
      ...actualFsPromises,
      // oxlint-disable-next-line typescript/require-await
      stat: async () => unsupportedStats,
    } as any;

    vi.resetModules();
    vi.doMock('node:fs/promises', () => mockedFsPromises);

    const { createZip: createZipWithMockedStat } = await import('../src/zipjs.js');

    await expect(createZipWithMockedStat(path.join(tempDirectory, 'unsupported.zip'), [sourcePath])).rejects.toThrow(`Unsupported source path type: ${sourcePath}`);

    vi.doUnmock('node:fs/promises');
    vi.resetModules();
  });

  test('rejects unsupported source path types', async () => {
    if (process.platform === 'win32') return;

    const tempDirectory = await createTempDirectory();
    const fifoPath = path.join(tempDirectory, 'pipe');

    await execFileAsync('mkfifo', [fifoPath]);

    await expect(createZip(path.join(tempDirectory, 'fifo.zip'), [fifoPath])).rejects.toThrow(`Unsupported source path type: ${fifoPath}`);
  });
});
