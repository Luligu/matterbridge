/**
 * clean.mjs
 * Version: 1.0.0
 *
 * Dependency-free replacement for `npx shx rm -rf *.tsbuildinfo dist build`.
 * Removes every *.tsbuildinfo file in the current directory and the dist and build directories.
 *
 * With `--workspace`, it first cleans the root directory and then cleans every
 * workspace listed in the root package.json `workspaces` array.
 *
 * Usage:
 *   node scripts/clean.mjs
 *   node scripts/clean.mjs --workspace
 */

import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

// `maxRetries` lets Node retry the EPERM/EBUSY errors Windows raises when a file is briefly locked
// (antivirus, file indexer, an open handle). A lock held by a running process cannot be retried
// away, so warn and continue instead of aborting the whole clean.
const rm = (dir, target) => {
  try {
    rmSync(resolve(dir, target), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EBUSY' || error.code === 'ENOTEMPTY') {
      // eslint-disable-next-line no-console
      console.warn(`Skipped locked path (${error.code}): ${error.path ?? target} — likely held by a running process.`);
      return;
    }
    throw error;
  }
};

const clean = (dir) => {
  let targets;
  try {
    targets = readdirSync(dir).filter((name) => name.endsWith('.tsbuildinfo'));
  } catch {
    return; // Directory does not exist, nothing to clean.
  }
  targets.push('dist', 'build');
  for (const target of targets) {
    rm(dir, target);
  }
};

clean(root);

if (process.argv.includes('--workspace')) {
  const { workspaces = [] } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  for (const workspace of workspaces) {
    clean(resolve(root, workspace));
  }
}
