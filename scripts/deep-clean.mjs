/**
 * deep-clean.mjs
 * Version: 1.3.0
 *
 * Dependency-free replacement for:
 *   npx shx rm -rf *.tsbuildinfo dist build coverage jest temp bun.lock package-lock.json npm-shrinkwrap.json \
 *     .cache/* .cache/.[!.]* .cache/..?* node_modules/* node_modules/.[!.]* node_modules/..?*
 *
 * Every removed path is logged under the directory it belongs to, prefixed with a red dash. The
 * emptied .cache and node_modules contents are logged as a single entry with their entry count,
 * since listing every removed package would bury the rest of the log.
 *
 * Fully removes the *.tsbuildinfo files, build/test output directories and lock files,
 * At the root, it empties the contents of .cache and node_modules while keeping those
 * directories. In workspaces, it removes the entire .cache and node_modules directories.
 *
 * With `--workspaces`, it first cleans the root directory and then cleans every
 * workspace listed in the root package.json `workspaces` array. Simple workspace
 * globs ending in `/*` (for example `packages/*` and `apps/*`) are expanded to
 * concrete child directories that contain a package.json.
 *
 * Usage:
 *   node scripts/deep-clean.mjs
 *   node scripts/deep-clean.mjs --workspaces
 *   node scripts/deep-clean.mjs --version
 *   node scripts/deep-clean.mjs --help
 *
 * Unknown arguments are rejected with exit code 1, so a mistyped flag never starts a clean.
 */

import { existsSync, lstatSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const version = '1.3.0';
const scriptName = path.basename(import.meta.filename);

/**
 * Handle the command line arguments.
 *
 * @returns {boolean} True when the clean should run, false after printing the version, the help or an argument error.
 */
const handleArgs = () => {
  const args = process.argv.slice(2);
  const knownArgs = new Set(['--workspaces', '--version', '-v', '--help', '-h']);
  const unknownArgs = args.filter((arg) => !knownArgs.has(arg));
  if (unknownArgs.length > 0) {
    // oxlint-disable-next-line no-console
    console.error(`Unknown argument${unknownArgs.length === 1 ? '' : 's'}: ${unknownArgs.join(', ')}. Run with --help for usage.`);
    process.exitCode = 1;
    return false;
  }

  if (args.includes('--version') || args.includes('-v')) {
    // oxlint-disable-next-line no-console
    console.log(version);
    return false;
  }

  if (args.includes('--help') || args.includes('-h')) {
    // oxlint-disable-next-line no-console
    console.log(`${scriptName} v.${version}

Remove every *.tsbuildinfo file, the build/test output directories and the lock files,\nand empty .cache and node_modules.

Usage:
  node scripts/${scriptName} [options]

Options:
  --workspaces   Also clean every workspace listed in the root package.json
  --version, -v  Show the script version
  --help, -h     Show this help message`);
    return false;
  }

  return true;
};

const shouldClean = handleArgs();

if (shouldClean) {
  // oxlint-disable-next-line no-console
  console.log(`${scriptName} v.${version}`);
}

const start = performance.now();
const root = process.cwd();

// Colors follow the NO_COLOR convention and are left out when the output is redirected,
// so a piped or captured log stays free of escape sequences.
const useColor = process.env.NO_COLOR === undefined && (process.stdout.isTTY === true || process.env.FORCE_COLOR !== undefined);
const red = (text) => (useColor ? `\u001B[31m${text}\u001B[0m` : text);

let removed = 0;
let loggedDir = null;

// The directory heading is printed lazily, so a directory with nothing to clean stays silent.
const logRemoved = (dir, entry, count = 1) => {
  if (loggedDir !== dir) {
    loggedDir = dir;
    const name = path.relative(root, dir);
    // oxlint-disable-next-line no-console
    console.log(name === '' ? path.basename(dir) : name);
  }
  removed += count;
  // oxlint-disable-next-line no-console
  console.log(`  ${red('-')} ${entry}`);
};

// `maxRetries` lets Node retry the EPERM/EBUSY errors Windows raises when a node_modules
// binary is read-only or briefly locked (antivirus, file indexer, an open handle). A lock held
// by a running process (e.g. an LSP with a native .node addon mapped) cannot be retried away,
// so warn and continue instead of aborting the whole clean.
// Returns whether the path was there and is now gone, so the caller can log it.
const rm = (dir, target) => {
  let stats;
  try {
    stats = lstatSync(path.resolve(dir, target));
  } catch {
    return null; // Path does not exist, nothing to remove and nothing to log.
  }

  try {
    rmSync(path.resolve(dir, target), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EBUSY' || error.code === 'ENOTEMPTY') {
      // oxlint-disable-next-line no-console
      console.warn(`Skipped locked path (${error.code}): ${error.path ?? target} — likely held by a running process.`);
      return null;
    }
    throw error;
  }

  return stats.isDirectory() ? `${target}/` : target;
};

const clean = (dir, workspace) => {
  // Fully removed entries. The `.cache/*`, `node_modules/*` style globs keep the parent
  // directory and only delete its contents, so those are handled separately below.
  let targets;
  try {
    targets = readdirSync(dir).filter((name) => name.endsWith('.tsbuildinfo'));
  } catch {
    return; // Directory does not exist, nothing to clean.
  }
  targets.push('dist', 'build', 'coverage', 'jest', 'temp', 'bun.lock', 'package-lock.json', 'npm-shrinkwrap.json');
  for (const target of targets) {
    const entry = rm(dir, target);
    if (entry !== null) logRemoved(dir, entry);
  }

  if (workspace) {
    for (const target of ['.cache', 'node_modules']) {
      const entry = rm(dir, target);
      if (entry !== null) logRemoved(dir, entry);
    }
    return;
  }

  // Empty the contents (including dotfiles) of these directories but keep the directory itself.
  for (const sub of ['.cache', 'node_modules']) {
    let entries;
    try {
      entries = readdirSync(path.resolve(dir, sub));
    } catch {
      continue; // Directory does not exist, nothing to empty.
    }

    // The contents are logged as one entry: a fresh node_modules holds hundreds of packages.
    let emptied = 0;
    for (const entry of entries) {
      if (rm(path.resolve(dir, sub), entry) !== null) emptied += 1;
    }
    if (emptied > 0) logRemoved(dir, `${sub}/* (${emptied} entr${emptied === 1 ? 'y' : 'ies'})`, emptied);
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

if (shouldClean) {
  clean(root, false);

  if (process.argv.includes('--workspaces')) {
    for (const workspaceDir of getWorkspaceDirs()) {
      clean(workspaceDir, true);
    }
  }

  const elapsed = `${Math.round(performance.now() - start)}ms`;
  // oxlint-disable-next-line no-console
  console.log(removed === 0 ? `Nothing to clean in ${elapsed}.` : `Cleaned ${removed} path${removed === 1 ? '' : 's'} in ${elapsed}.`);
}
