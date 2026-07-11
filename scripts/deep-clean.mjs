/**
 * deep-clean.mjs
 * Version: 1.1.0
 *
 * Dependency-free replacement for:
 *   npx shx rm -rf *.tsbuildinfo dist build coverage jest temp package-lock.json npm-shrinkwrap.json \
 *     .cache/* .cache/.[!.]* .cache/..?* node_modules/* node_modules/.[!.]* node_modules/..?*
 *
 * Fully removes the *.tsbuildinfo files, build/test output directories and lock files,
 * then empties the contents of .cache and node_modules while keeping those directories.
 *
 * With `--workspaces`, it first cleans the root directory and then cleans every
 * workspace listed in the root package.json `workspaces` array. Simple workspace
 * globs ending in `/*` (for example `packages/*` and `apps/*`) are expanded to
 * concrete child directories that contain a package.json.
 *
 * Usage:
 *   node scripts/deep-clean.mjs
 *   node scripts/deep-clean.mjs --workspaces
 */

import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
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
  // Fully removed entries. The `.cache/*`, `node_modules/*` style globs keep the parent
  // directory and only delete its contents, so those are handled separately below.
  let targets;
  try {
    targets = readdirSync(dir).filter((name) => name.endsWith('.tsbuildinfo'));
  } catch {
    return; // Directory does not exist, nothing to clean.
  }
  targets.push('dist', 'build', 'coverage', 'jest', 'temp', 'package-lock.json', 'npm-shrinkwrap.json');
  for (const target of targets) {
    rm(dir, target);
  }

  // Empty the contents (including dotfiles) of these directories but keep the directory itself.
  for (const sub of ['.cache', 'node_modules']) {
    let entries;
    try {
      entries = readdirSync(resolve(dir, sub));
    } catch {
      continue; // Directory does not exist, nothing to empty.
    }
    for (const entry of entries) {
      rm(resolve(dir, sub), entry);
    }
  }
};

const getWorkspaceDirs = () => {
  const { workspaces = [] } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const patterns = Array.isArray(workspaces) ? workspaces : (workspaces.packages ?? []);
  const dirs = [];

  for (const pattern of patterns) {
    if (!pattern.endsWith('/*')) {
      const dir = resolve(root, pattern);
      if (existsSync(resolve(dir, 'package.json'))) dirs.push(dir);
      continue;
    }

    const parentDir = resolve(root, pattern.slice(0, -2));
    let entries;
    try {
      entries = readdirSync(parentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = resolve(parentDir, entry.name);
      if (existsSync(resolve(dir, 'package.json'))) dirs.push(dir);
    }
  }

  return dirs;
};

clean(root);

if (process.argv.includes('--workspaces')) {
  for (const workspaceDir of getWorkspaceDirs()) {
    clean(workspaceDir);
  }
}
