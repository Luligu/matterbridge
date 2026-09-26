/**
 * clean.mjs
 * Version: 1.2.0
 *
 * Dependency-free replacement for `npx shx rm -rf *.tsbuildinfo dist build`.
 * Removes every *.tsbuildinfo file in the current directory and the dist and build directories.
 *
 * Every removed path is logged under the directory it belongs to, prefixed with a red dash.
 *
 * With `--workspaces`, it first cleans the root directory and then cleans every
 * workspace listed in the root package.json `workspaces` array. Simple workspace
 * globs ending in `/*` (for example `packages/*` and `apps/*`) are expanded to
 * concrete child directories that contain a package.json.
 *
 * Usage:
 *   node scripts/clean.mjs
 *   node scripts/clean.mjs --workspaces
 */

import { lstatSync, existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const version = '1.2.0';

// oxlint-disable-next-line no-console
console.log(`${path.basename(import.meta.filename)} v.${version}`);

const start = performance.now();
const root = process.cwd();

// Colors follow the NO_COLOR convention and are left out when the output is redirected,
// so a piped or captured log stays free of escape sequences.
const useColor = process.env.NO_COLOR === undefined && (process.stdout.isTTY === true || process.env.FORCE_COLOR !== undefined);
const red = (text) => (useColor ? `\u001B[31m${text}\u001B[0m` : text);

let removed = 0;
let loggedDir = null;

// The directory heading is printed lazily, so a directory with nothing to clean stays silent.
const logRemoved = (dir, entry) => {
  if (loggedDir !== dir) {
    loggedDir = dir;
    const name = path.relative(root, dir);
    // oxlint-disable-next-line no-console
    console.log(name === '' ? path.basename(dir) : name);
  }
  removed += 1;
  // oxlint-disable-next-line no-console
  console.log(`  ${red('-')} ${entry}`);
};

// `maxRetries` lets Node retry the EPERM/EBUSY errors Windows raises when a file is briefly locked
// (antivirus, file indexer, an open handle). A lock held by a running process cannot be retried
// away, so warn and continue instead of aborting the whole clean.
const rm = (dir, target) => {
  let stats;
  try {
    stats = lstatSync(path.resolve(dir, target));
  } catch {
    return; // Path does not exist, nothing to remove and nothing to log.
  }

  try {
    rmSync(path.resolve(dir, target), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EBUSY' || error.code === 'ENOTEMPTY') {
      // oxlint-disable-next-line no-console
      console.warn(`Skipped locked path (${error.code}): ${error.path ?? target} — likely held by a running process.`);
      return;
    }
    throw error;
  }

  logRemoved(dir, stats.isDirectory() ? `${target}/` : target);
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

const getWorkspaceDirs = () => {
  const { workspaces = [] } = JSON.parse(readFileSync(path.resolve(root, 'package.json'), 'utf8'));
  const patterns = Array.isArray(workspaces) ? workspaces : (workspaces.packages ?? []);
  const dirs = [];

  for (const pattern of patterns) {
    if (!pattern.endsWith('/*')) {
      const dir = path.resolve(root, pattern);
      if (existsSync(path.resolve(dir, 'package.json'))) dirs.push(dir);
      continue;
    }

    const parentDir = path.resolve(root, pattern.slice(0, -2));
    let entries;
    try {
      entries = readdirSync(parentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.resolve(parentDir, entry.name);
      if (existsSync(path.resolve(dir, 'package.json'))) dirs.push(dir);
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

const elapsed = `${Math.round(performance.now() - start)}ms`;
// oxlint-disable-next-line no-console
console.log(removed === 0 ? `Nothing to clean in ${elapsed}.` : `Cleaned ${removed} path${removed === 1 ? '' : 's'} in ${elapsed}.`);
