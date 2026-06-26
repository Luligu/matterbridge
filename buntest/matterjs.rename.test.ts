// buntest/matterjs.rename.test.ts

// PROTOTYPE — Bun + Windows atomic-write EPERM: what fails, what does NOT fix it, and what does.
//
// Reproduces the exact matter.js storage atomic write and isolates the trigger. See the analysis in
// ./bunMatterTest.test.ts.
//
// Origin of the failure (matter.js):
//   File:     node_modules/@matter/nodejs/src/storage/fs/FileStorageDriver.ts
//   Line:     308  (method #writeAndMoveFile, lines 267-309)
//   Fragment:
//     const handle = await open(tmpName, "w");
//     const writer = handle.createWriteStream({ encoding: isStream ? null : "utf8", flush: true });
//     // ...write...
//     await handle.close();
//     await rename(tmpName, filepath);   // <-- EPERM on Bun/Windows
//
// Findings on Bun/Windows (this machine), each looped 500x:
//   - createWriteStream + handle.close() + rename            => EPERM        (the matter.js path)
//   - createWriteStream + handle.close() + rename-with-retry => EPERM        (retry does NOT help: the
//                                                                             handle is never released,
//                                                                             so fix option 3 is out)
//   - writeFile(tmp) + rename                                => OK
//   (handle.writeFile() and Bun.write() also OK — all non-stream writes work.)
//
// Conclusion: the bug is specific to FileHandle.createWriteStream({ flush: true }) + handle.close() not
// releasing the underlying Windows handle before close() resolves. Windows then refuses to rename the
// still-open .tmp file (EPERM); POSIX allows rename over open files, so Linux/macOS never reproduce it.
// The actionable fix is to write the temp file with writeFile for the (common) string path instead of a
// FileHandle write stream — NOT to retry the rename.
//
// This test stays green on every platform: the failing strategies are *observed* (asserted to only throw
// on Bun/Windows with a Windows lock code), and the writeFile strategy is asserted to always succeed.
//
// Run from the repo root with:  bun test  (bunfig.toml scopes discovery to buntest/).

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const HOMEDIR = path.join('.cache', 'bun', 'matterjs-rename');
const ITERATIONS = 500;

// Windows lock codes that a rename-retry wrapper would treat as transient.
const TRANSIENT_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);

const isBunWindows = process.platform === 'win32' && typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined';

/**
 * Write a temp file the matter.js way: through a FileHandle write stream, then close the handle.
 *
 * @param {string} tmpName The temp file path.
 * @param {string} value The content to write.
 * @returns {Promise<void>} Resolves when the temp file is written and the handle is closed.
 */
async function writeTmpViaStream(tmpName: string, value: string): Promise<void> {
  const handle = await open(tmpName, 'w');
  const writer = handle.createWriteStream({ encoding: 'utf8', flush: true });
  await new Promise<void>((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
    writer.write(value);
    writer.end();
  });
  await handle.close();
}

/**
 * Write a temp file with writeFile (the candidate fix for the string path).
 *
 * @param {string} tmpName The temp file path.
 * @param {string} value The content to write.
 * @returns {Promise<void>} Resolves when the temp file has been written and closed.
 */
async function writeTmpViaWriteFile(tmpName: string, value: string): Promise<void> {
  await writeFile(tmpName, value, { encoding: 'utf8' });
}

/**
 * Retry rename on transient Windows lock codes with linear backoff (the disproven fix option 3).
 *
 * @param {string} from The source path.
 * @param {string} to The destination path.
 * @param {number} retries Maximum number of extra attempts (default 10).
 * @param {number} delayMs Base backoff in ms, multiplied by the attempt count (default 5).
 * @returns {Promise<void>} Resolves when the rename succeeds.
 */
async function renameWithRetry(from: string, to: string, retries: number = 10, delayMs: number = 5): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt >= retries || code === undefined || !TRANSIENT_CODES.has(code)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
}

/**
 * Run the write+rename loop and return the error it threw, if any.
 *
 * @param {string} filepath The final file path.
 * @param {(tmpName: string, value: string) => Promise<void>} writeTmp How to write the temp file.
 * @param {(from: string, to: string) => Promise<void>} renameFn How to move the temp file into place.
 * @returns {Promise<NodeJS.ErrnoException | undefined>} The thrown error, or undefined on success.
 */
async function runLoop(
  filepath: string,
  writeTmp: (tmpName: string, value: string) => Promise<void>,
  renameFn: (from: string, to: string) => Promise<void>,
): Promise<NodeJS.ErrnoException | undefined> {
  try {
    for (let i = 0; i < ITERATIONS; i++) {
      const tmpName = `${filepath}.tmp`;
      await writeTmp(tmpName, `v${i}`);
      await renameFn(tmpName, filepath);
    }
    return undefined;
  } catch (error) {
    return error as NodeJS.ErrnoException;
  }
}

describe('matterjs atomic rename (Bun/Windows EPERM prototype)', () => {
  beforeAll(async () => {
    await rm(HOMEDIR, { recursive: true, force: true });
    await mkdir(HOMEDIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(HOMEDIR, { recursive: true, force: true });
  });

  test('matter.js createWriteStream pattern EPERMs on Bun/Windows only', async () => {
    const filepath = path.join(HOMEDIR, 'stream.__nextNumber__');
    const thrown = await runLoop(filepath, writeTmpViaStream, rename);

    if (thrown) {
      expect(isBunWindows).toBe(true);
      expect(TRANSIENT_CODES.has(thrown.code ?? '')).toBe(true);
      // oxlint-disable-next-line eslint/no-console
      console.log(`[matterjs.rename] createWriteStream reproduced ${thrown.code} on Bun/Windows (expected)`);
    } else {
      expect(await readFile(filepath, 'utf8')).toBe(`v${ITERATIONS - 1}`);
    }
  });

  test('rename-with-retry does NOT fix the createWriteStream pattern (option 3 disproven)', async () => {
    const filepath = path.join(HOMEDIR, 'retry.__nextNumber__');
    const thrown = await runLoop(filepath, writeTmpViaStream, renameWithRetry);

    if (thrown) {
      // Retry exhausts and still throws: the handle is never released, so retrying is pointless.
      expect(isBunWindows).toBe(true);
      expect(thrown.code).toBe('EPERM');
      // oxlint-disable-next-line eslint/no-console
      console.log('[matterjs.rename] rename-with-retry still EPERMs on Bun/Windows (retry is not a fix)');
    } else {
      expect(await readFile(filepath, 'utf8')).toBe(`v${ITERATIONS - 1}`);
    }
  });

  test('writeFile-based atomic write completes on every platform (the fix)', async () => {
    const filepath = path.join(HOMEDIR, 'writefile.__nextNumber__');
    const thrown = await runLoop(filepath, writeTmpViaWriteFile, rename);

    expect(thrown).toBeUndefined();
    expect(await readFile(filepath, 'utf8')).toBe(`v${ITERATIONS - 1}`);
  });
});
