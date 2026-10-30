/**
 * git-sync-dev.mjs
 * Version: 2.1.0
 *
 * Syncs the dev branch with origin/main via merge or rebase, after creating
 * a timestamped local backup branch and fetching from origin.
 * It stops before touching anything when origin/dev has commits that the local
 * dev lacks (pushed from another machine), since the push would drop them.
 *
 * Usage:
 *   node scripts/git-sync-dev.mjs --version, -v  Show the script version
 *   node scripts/git-sync-dev.mjs --help, -h     Show the help
 *   node scripts/git-sync-dev.mjs [--dry-run|-n] merge
 *   node scripts/git-sync-dev.mjs [--dry-run|-n] rebase
 *
 * The script runs only when executed directly. Importing it exposes `main` without side effects.
 */

/* oxlint-disable no-console */

import { execFileSync } from 'node:child_process';
import path from 'node:path';

const scriptVersion = '2.1.0';

/**
 * Builds the help text.
 *
 * @returns {string} The usage message.
 */
function usage() {
  return [
    'Usage: node scripts/git-sync-dev.mjs [--dry-run|-n] <merge|rebase>',
    '',
    'Examples:',
    '  node scripts/git-sync-dev.mjs merge',
    '  node scripts/git-sync-dev.mjs --dry-run rebase',
    '',
    '  --dry-run, -n  Print the git commands without running them',
    '  --version, -v  Show the script version',
    '  --help, -h     Show this help message',
  ].join('\n');
}

/**
 * Executes Git with inherited standard input/output, or only prints the command in dry-run mode.
 *
 * @param {string[]} args Git command arguments.
 * @param {boolean} dryRun When true, print the command instead of running it.
 * @returns {void}
 */
function git(args, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] git ${args.join(' ')}`);
    return;
  }
  execFileSync('git', args, {
    stdio: 'inherit',
    shell: false,
  });
}

/**
 * Checks that the local dev contains every commit of origin/dev, or prints the dry-run commands.
 *
 * @param {boolean} dryRun When true, print the check instead of running it.
 * @returns {boolean} False when origin/dev has commits that the local dev lacks.
 */
function includesRemoteDev(dryRun) {
  const check = ['merge-base', '--is-ancestor', 'refs/remotes/origin/dev', 'dev'];
  if (dryRun) {
    console.log(`[dry-run] git ${check.join(' ')}`);
    return true;
  }
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/dev'], { stdio: 'ignore', shell: false });
  } catch {
    // No origin/dev yet: there is nothing on the remote to lose.
    return true;
  }
  try {
    execFileSync('git', check, { stdio: 'ignore', shell: false });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a filesystem- and Git-ref-safe local timestamp.
 *
 * @returns {string} Timestamp formatted as YYYYMMDD-HHmmss.
 */
function createTimestamp() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * Sync the dev branch with origin/main.
 *
 * @param {string[]} [args] Command line arguments, without the runtime and script paths.
 * @returns {number} The exit code.
 */
export function main(args = process.argv.slice(2)) {
  if (args.includes('--version') || args.includes('-v')) {
    console.log(scriptVersion);
    return 0;
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return 0;
  }

  const dryRun = args.includes('--dry-run') || args.includes('-n');
  const positional = args.filter((arg) => arg !== '--dry-run' && arg !== '-n');
  const unknownArgs = positional.filter((arg) => arg.startsWith('-'));
  const operation = positional[0];

  if (unknownArgs.length > 0 || positional.length !== 1 || (operation !== 'merge' && operation !== 'rebase')) {
    console.error(usage());
    return 1;
  }

  const backupBranch = `dev-backup-${createTimestamp()}`;

  git(['fetch', 'origin'], dryRun);
  git(['switch', 'dev'], dryRun);

  // The fetch refreshes origin/dev, so --force-with-lease alone would always pass and overwrite commits pushed from elsewhere.
  if (!includesRemoteDev(dryRun)) {
    console.error('origin/dev has commits that the local dev lacks. Bring them into dev first (git pull origin dev), then run it again.');
    return 1;
  }

  git(['branch', backupBranch], dryRun);

  console.log(`${dryRun ? '[dry-run] Would create' : 'Created'} backup branch: ${backupBranch}`);

  if (operation === 'merge') {
    git(['merge', 'origin/main'], dryRun);
    git(['push', 'origin', 'dev'], dryRun);
  } else {
    git(['rebase', 'origin/main'], dryRun);
    git(['push', '--force-with-lease', '--force-if-includes', 'origin', 'dev'], dryRun);
  }
  return 0;
}

// `import.meta.main` needs Node.js 22.18 or 24.2; older runtimes fall back to comparing the executed script path.
if (import.meta.main ?? path.resolve(process.argv[1] ?? '') === import.meta.filename) process.exitCode = main();
