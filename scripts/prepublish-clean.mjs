/**
 * prepublish-clean.mjs
 * Version: 1.0.0
 *
 * Dependency-free replacement for:
 *   npx shx rm -rf node_modules/* node_modules/.[!.]* node_modules/..?* package-lock.json npm-shrinkwrap.json
 *
 * Empties the contents of node_modules (including dotfiles) while keeping the directory,
 * then removes the lock files.
 *
 * With `--workspace`, it first cleans the root directory and then cleans every
 * workspace listed in the root package.json `workspaces` array.
 *
 * Usage:
 *   node scripts/prepublish-clean.mjs
 *   node scripts/prepublish-clean.mjs --workspace
 */

import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

// `maxRetries` lets Node retry the EPERM/EBUSY errors Windows raises when a node_modules
// binary is read-only or briefly locked (antivirus, file indexer, an open handle). A lock held
// by a running process (e.g. an LSP with a native .node addon mapped) cannot be retried away,
// so warn and continue instead of aborting the whole clean.
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
  // Empty the contents (including dotfiles) of node_modules but keep the directory itself.
  try {
    for (const entry of readdirSync(resolve(dir, 'node_modules'))) {
      rm(resolve(dir, 'node_modules'), entry);
    }
  } catch {
    // node_modules does not exist, nothing to empty.
  }

  // Fully remove the lock files.
  rm(dir, 'package-lock.json');
  rm(dir, 'npm-shrinkwrap.json');
};

clean(root);

if (process.argv.includes('--workspace')) {
  const { workspaces = [] } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  for (const workspace of workspaces) {
    clean(resolve(root, workspace));
  }
}
