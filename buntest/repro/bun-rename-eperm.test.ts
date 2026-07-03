// buntest/repro/bun-rename-eperm.test.ts

// Bug repro: on Bun for Windows, FileHandle.createWriteStream({ flush: true }) followed by
// handle.close() does not release the underlying OS file handle before close() resolves. A
// rename() of that just-written temp file then fails with EPERM. Node releases the handle on
// close(), and POSIX allows renaming an open file, so this passes on Node and on Linux/macOS.
//
// Expected: the loop completes; every rename() succeeds (as on Node).
// Actual on Bun/Windows: EPERM: operation not permitted, rename '<file>.tmp' -> '<file>'.
//
// Run:  bun test buntest/repro/bun-rename-eperm.test.ts

import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';

const DIR = path.join('.cache', 'bun', 'repro-rename');
const ITERATIONS = 500;

beforeAll(async () => {
  await rm(DIR, { recursive: true, force: true });
  await mkdir(DIR, { recursive: true });
});

afterAll(async () => {
  await rm(DIR, { recursive: true, force: true });
});

test('createWriteStream + close + rename completes without EPERM', async () => {
  const filepath = path.join(DIR, 'file');

  for (let i = 0; i < ITERATIONS; i++) {
    const tmp = `${filepath}.tmp`;
    const handle = await open(tmp, 'w');
    const writer = handle.createWriteStream({ encoding: 'utf8', flush: true });
    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
      writer.write(`v${i}`);
      writer.end();
    });
    await handle.close();
    await rename(tmp, filepath);
  }

  expect(await readFile(filepath, 'utf8')).toBe(`v${ITERATIONS - 1}`);
});
