/**
 * version.mjs
 * Version: 2.0.0
 *
 * Updates package.json version to:
 *   <baseVersion>-<dev|edge|git|local|bun>-<yyyymmdd>-<7charSha>
 *
 * Usage:
 *   node scripts/version.mjs --version, -v  Show the script version
 *   node scripts/version.mjs --help, -h     Show the help
 *   node scripts/version.mjs <dev|edge|git|local|bun> [--dry-run]
 *
 * The script runs only when executed directly. Importing it exposes `main` without side effects.
 */

/* oxlint-disable no-console */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptVersion = '2.0.0';

function usage() {
  return [
    'Usage: node scripts/version.mjs <dev|edge|git|local|bun> [--dry-run]',
    '   or: node scripts/version.mjs --dry-run <dev|edge|git|local|bun>',
    '',
    'Updates package.json version to:',
    '  <baseVersion>-<dev|edge|git|local|bun>-<yyyymmdd>-<7charSha>',
    '',
    'Options:',
    '  --dry-run, -n   Print the next version but do not write package.json',
    '',
    '  --version, -v  Show the script version',
    '  --help, -h     Show this help message',
  ].join('\n');
}

/**
 * Format yyyymmdd.
 *
 * @param {Date} date date value.
 * @returns {string} The result.
 */
function formatYyyymmdd(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Short sha from git.
 *
 * @param {string} repoRoot repoRoot value.
 * @returns {string} The result.
 */
function shortSha7FromGit(repoRoot) {
  const out = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const sha = out.trim();
  if (!/^[0-9a-f]{7}$/i.test(sha)) {
    throw new Error(`Unexpected git short SHA output: ${JSON.stringify(sha)}`);
  }
  return sha.toLowerCase();
}

/**
 * Get short sha.
 *
 * @param {string} repoRoot repoRoot value.
 * @returns {string} The result.
 */
function getShortSha7(repoRoot) {
  try {
    return shortSha7FromGit(repoRoot);
  } catch (err) {
    throw new Error(`Unable to determine git short SHA. (${err instanceof Error ? err.message : String(err)})`, { cause: err });
  }
}

/**
 * Require plain semver.
 *
 * @param {string | number | boolean | null | undefined} version version value.
 * @returns {string} The result.
 */
function requirePlainSemver(version) {
  const trimmed = String(version ?? '').trim();
  if (!/^\d+\.\d+\.\d+$/.test(trimmed)) {
    throw new Error(`package.json version must be plain x.y.z (got: ${JSON.stringify(trimmed)})`);
  }
  return trimmed;
}

/**
 * Update the package.json version.
 *
 * @param {string[]} [args] Command line arguments, without the runtime and script paths.
 * @param {string} [repoRoot] Directory containing the package.json.
 * @returns {Promise<number>} The exit code.
 */
export async function main(args = process.argv.slice(2), repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')) {
  if (args.includes('--version') || args.includes('-v')) {
    console.log(scriptVersion);
    return 0;
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return 0;
  }

  const knownFlags = new Set(['--dry-run', '-n']);
  const unknownFlags = args.filter((a) => a.startsWith('-') && !knownFlags.has(a));
  if (unknownFlags.length > 0) {
    console.error(`Unknown option(s): ${unknownFlags.join(', ')}`);
    console.error(usage());
    return 1;
  }

  const dryRun = args.includes('--dry-run') || args.includes('-n');
  const tag = args.find((a) => !a.startsWith('-'))?.toLowerCase();
  if (tag !== 'dev' && tag !== 'edge' && tag !== 'git' && tag !== 'local' && tag !== 'bun') {
    console.error('Missing or invalid parameter (expected dev, edge, git, local, or bun).');
    console.error(usage());
    return 1;
  }

  const packageJsonPath = path.join(repoRoot, 'package.json');

  const raw = await fs.readFile(packageJsonPath, 'utf8');
  const pkg = JSON.parse(raw);

  const currentVersion = pkg.version;
  const baseVersion = requirePlainSemver(currentVersion);
  const yyyymmdd = formatYyyymmdd(new Date());
  const sha7 = getShortSha7(repoRoot);

  const nextVersion = `${baseVersion}-${tag}-${yyyymmdd}-${sha7}`;
  pkg.version = nextVersion;

  if (dryRun) {
    console.log(`[dry-run] package.json version: ${currentVersion} -> ${nextVersion}`);
  } else {
    await fs.writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    console.log(`package.json version: ${currentVersion} -> ${nextVersion}`);
  }
  return 0;
}

// `import.meta.main` needs Node.js 22.18 or 24.2; older runtimes fall back to comparing the executed script path.
if (import.meta.main ?? path.resolve(process.argv[1] ?? '') === import.meta.filename) process.exitCode = await main();
