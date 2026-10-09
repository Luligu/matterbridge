/**
 * clean.mjs
 * Version: 2.0.0
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
 *   node scripts/clean.mjs --dry-run, -n
 *   node scripts/clean.mjs --version
 *   node scripts/clean.mjs --help
 *
 * Unknown arguments are rejected with exit code 1, so a mistyped flag never starts a clean.
 *
 * The script runs only when executed directly. Importing it exposes `main` without side effects.
 */

/* oxlint-disable no-console */
/* oxlint-disable typescript/no-unsafe-type-assertion */

import { lstatSync, existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const scriptVersion = '2.0.0';
const scriptName = path.basename(import.meta.filename);

/**
 * Handle the command line arguments.
 *
 * @param {string[]} args Command line arguments.
 * @returns {number | null} The exit code after printing the version, the help or an argument error, null when the clean should run.
 */
const handleArgs = (args) => {
  const knownArgs = new Set(['--workspaces', '--dry-run', '-n', '--version', '-v', '--help', '-h']);
  const unknownArgs = args.filter((arg) => !knownArgs.has(arg));
  if (unknownArgs.length > 0) {
    console.error(`Unknown argument${unknownArgs.length === 1 ? '' : 's'}: ${unknownArgs.join(', ')}. Run with --help for usage.`);
    return 1;
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(scriptVersion);
    return 0;
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`${scriptName} v.${scriptVersion}

Remove every *.tsbuildinfo file and the dist and build directories.

Usage:
  node scripts/${scriptName} [options]

Options:
  --workspaces   Also clean every workspace listed in the root package.json
  --dry-run, -n  List what would be removed without removing anything
  --version, -v  Show the script version
  --help, -h     Show this help message`);
    return 0;
  }

  return null;
};

// Colors follow the NO_COLOR convention and are left out when the output is redirected,
// so a piped or captured log stays free of escape sequences.
const useColor = process.env.NO_COLOR === undefined && (process.stdout.isTTY || process.env.FORCE_COLOR !== undefined);
/**
 * Color text when terminal colors are enabled.
 *
 * @param {string} text Text to color.
 * @returns {string} The colored or original text.
 */
const red = (text) => (useColor ? `\u001B[31m${text}\u001B[0m` : text);

/**
 * State of a single clean run.
 *
 * @typedef {object} CleanState
 * @property {string} root Root directory of the run.
 * @property {boolean} dryRun When true, list the paths without removing them.
 * @property {number} removed Number of removed paths.
 * @property {string | null} loggedDir Directory whose heading was printed last.
 */

// The directory heading is printed lazily, so a directory with nothing to clean stays silent.
/**
 * Log a removed entry under its directory.
 *
 * @param {CleanState} state State of the run.
 * @param {string} dir Directory containing the entry.
 * @param {string} entry Removed entry to log.
 * @returns {void}
 */
const logRemoved = (state, dir, entry) => {
  if (state.loggedDir !== dir) {
    state.loggedDir = dir;
    const name = path.relative(state.root, dir);
    console.log(name === '' ? path.basename(dir) : name);
  }
  state.removed += 1;
  console.log(`  ${red('-')} ${entry}`);
};

// `maxRetries` lets Node retry the EPERM/EBUSY errors Windows raises when a file is briefly locked
// (antivirus, file indexer, an open handle). A lock held by a running process cannot be retried
// away, so warn and continue instead of aborting the whole clean.
/**
 * Remove a path with retries for temporary locks.
 *
 * @param {CleanState} state State of the run.
 * @param {string} dir Directory containing the target.
 * @param {string} target Relative path to remove.
 * @returns {void} No return value.
 */
const rm = (state, dir, target) => {
  let stats;
  try {
    stats = lstatSync(path.resolve(dir, target));
  } catch (caughtError) {
    const error = /** @type {NodeJS.ErrnoException} */ (caughtError);
    if (error.code === 'ENOENT') return; // Path does not exist, nothing to remove and nothing to log.
    console.warn(`Skipped unreadable path (${error.code}): ${error.path ?? target}`);
    return;
  }

  if (state.dryRun) {
    logRemoved(state, dir, stats.isDirectory() ? `${target}/` : target);
    return;
  }

  try {
    rmSync(path.resolve(dir, target), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (caughtError) {
    const error = /** @type {NodeJS.ErrnoException} */ (caughtError);
    if (error.code === 'EPERM' || error.code === 'EBUSY' || error.code === 'ENOTEMPTY') {
      console.warn(`Skipped locked path (${error.code}): ${error.path ?? target} — likely held by a running process.`);
      return;
    }
    throw error;
  }

  logRemoved(state, dir, stats.isDirectory() ? `${target}/` : target);
};

/**
 * Clean generated files in a directory.
 *
 * @param {CleanState} state State of the run.
 * @param {string} dir Directory to clean.
 * @returns {void}
 */
const clean = (state, dir) => {
  let targets;
  try {
    targets = readdirSync(dir).filter((name) => name.endsWith('.tsbuildinfo'));
  } catch {
    return; // Directory does not exist, nothing to clean.
  }
  targets.push('dist', 'build');
  for (const target of targets) {
    rm(state, dir, target);
  }
};

/**
 * Collect the workspace directories listed in the root package.json that contain a package.json.
 *
 * @param {string} root Root directory containing the package.json.
 * @returns {string[]} The absolute paths of the workspace directories.
 */
const getWorkspaceDirs = (root) => {
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

/**
 * Run the clean.
 *
 * @param {string[]} [args] Command line arguments, without the runtime and script paths.
 * @param {string} [root] Directory to clean.
 * @returns {number} The exit code.
 */
export const main = (args = process.argv.slice(2), root = process.cwd()) => {
  const exitCode = handleArgs(args);
  if (exitCode !== null) return exitCode;

  console.log(`${scriptName} v.${scriptVersion}`);
  const start = performance.now();
  /** @type {CleanState} */
  const state = { root, dryRun: args.includes('--dry-run') || args.includes('-n'), removed: 0, loggedDir: null };

  clean(state, root);

  if (args.includes('--workspaces')) {
    for (const workspaceDir of getWorkspaceDirs(root)) {
      clean(state, workspaceDir);
    }
  }

  const elapsed = `${Math.round(performance.now() - start)}ms`;
  const paths = `${state.removed} path${state.removed === 1 ? '' : 's'}`;
  if (state.removed === 0) console.log(`Nothing to clean in ${elapsed}.`);
  else console.log(state.dryRun ? `Dry run: would clean ${paths} in ${elapsed}.` : `Cleaned ${paths} in ${elapsed}.`);
  return 0;
};

// `import.meta.main` needs Node.js 22.18 or 24.2; older runtimes fall back to comparing the executed script path.
if (import.meta.main ?? path.resolve(process.argv[1] ?? '') === import.meta.filename) process.exitCode = main();
