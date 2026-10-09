/**
 * git-status.mjs
 * Version: 2.0.0
 *
 * Prints a summary of the current git repository status.
 *
 * Usage:
 *   node scripts/git-status.mjs --version, -v  Show the script version
 *   node scripts/git-status.mjs --help, -h     Show the help
 *   node scripts/git-status.mjs [--dry-run|-n] [topN] [remote]
 *
 * The script runs only when executed directly. Importing it exposes `main` without side effects.
 */

/* oxlint-disable no-console */
/* oxlint-disable unicorn/no-useless-undefined */
/* oxlint-disable typescript/prefer-nullish-coalescing */

import { spawnSync } from 'node:child_process';
import path from 'node:path';

const scriptVersion = '2.0.0';

class ExitError extends Error {
  /**
   * Create a CLI exit error.
   *
   * @param {string} message Error message.
   * @param {number} [code] Exit status.
   */
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

function usage() {
  return [
    'Usage: node scripts/git-status.mjs [--dry-run|-n] [topN] [remote]',
    '',
    'Examples:',
    '  node scripts/git-status.mjs',
    '  node scripts/git-status.mjs 50',
    '  node scripts/git-status.mjs 100 origin',
    '',
    '  --dry-run, -n  Print the parsed options without running the analysis',
    '  --version, -v  Show the script version',
    '  --help, -h     Show this help message',
  ].join('\n');
}

function createColors() {
  const enabled = process.stdout.isTTY && !process.env.NO_COLOR;
  /**
   * Create a colorizer for an ANSI SGR open/close pair.
   *
   * @param {number} open Opening SGR code.
   * @param {number} close Closing SGR code.
   * @returns {(value: string) => string} The colorizer, returning the plain value when colors are disabled.
   */
  const color = (open, close) => (value) => (enabled ? `\u001B[${open}m${value}\u001B[${close}m` : value);

  return {
    bold: color(1, 22),
    cyan: color(36, 39),
    dim: color(2, 22),
    green: color(32, 39),
    red: color(31, 39),
    yellow: color(33, 39),
  };
}

const colors = createColors();

function lineWidth() {
  return Math.min(120, Math.max(60, process.stdout.columns || 80));
}

function hr() {
  console.log(colors.dim('-'.repeat(lineWidth())));
}

/**
 * Section.
 *
 * @param {string} title title value.
 * @returns {void} No return value.
 */
function section(title) {
  hr();
  console.log(colors.bold(colors.cyan(title)));
  hr();
}

/**
 * Throw an ExitError.
 *
 * @param {string} message - Error message.
 * @param {number} [code] - Exit code.
 * @returns {never} Never returns.
 */
function fail(message, code = 1) {
  throw new ExitError(message, code);
}

/**
 * Parse args.
 *
 * @param {string[]} argv argv value.
 * @returns {{dryRun: boolean, remote: string, topN: number} | undefined} The result.
 */
function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage());

    return undefined;
  }

  const dryRun = argv.includes('--dry-run') || argv.includes('-n');
  const [topNArg = '30', remote = 'origin'] = argv.filter((arg) => arg !== '--dry-run' && arg !== '-n');
  if (!/^\d+$/.test(topNArg) || Number(topNArg) <= 0) {
    fail(`Invalid topN value: ${JSON.stringify(topNArg)}\n\n${usage()}`);
  }

  return {
    dryRun,
    remote,
    topN: Number(topNArg),
  };
}

/**
 * @overload
 * @param {string[]} args Git arguments.
 * @param {{allowFailure: true, input?: string}} options Command options.
 * @returns {string | undefined} Captured output or undefined on failure.
 */
/**
 * @overload
 * @param {string[]} args Git arguments.
 * @param {{allowFailure?: false, input?: string}} [options] Command options.
 * @returns {string} Captured output.
 */
/**
 * Git.
 *
 * @param {string[]} args args value.
 * @param {{allowFailure?: boolean, input?: string, inherit?: boolean}} [options] options value.
 * @returns {string | undefined} The result.
 */
// oxlint-disable-next-line typescript/consistent-return -- ends with fail(), which always throws
function git(args, options = {}) {
  const { allowFailure = false, input } = options;
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    input,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const stdout = result.stdout?.trimEnd() ?? '';
  const stderr = result.stderr?.trimEnd() ?? '';
  if (result.status === 0) {
    return stdout;
  }

  if (allowFailure) {
    return undefined;
  }

  const details = [stderr, stdout].filter(Boolean).join('\n');
  fail(details ? `git ${args.join(' ')} failed:\n${details}` : `git ${args.join(' ')} failed.`);
}

/**
 * Human bytes.
 *
 * @param {number} bytes bytes value.
 * @returns {string} The result.
 */
function humanBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  // oxlint-disable-next-line typescript/no-unnecessary-type-conversion -- Preserve the template conversion behavior.
  let value = Number(bytes);
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Print key value.
 *
 * @param {string} key key value.
 * @param {unknown} value value value.
 * @param {(value: string) => string} [colorizer] colorizer value.
 * @returns {void} No return value.
 */
function printKeyValue(key, value, colorizer) {
  const renderedValue = colorizer ? colorizer(String(value)) : String(value);
  console.log(`${key.padEnd(12)} ${renderedValue}`);
}

/**
 * Parse remote tag count.
 *
 * @param {string} remote remote value.
 * @returns {number | undefined} The result.
 */
function parseRemoteTagCount(remote) {
  const raw = git(['ls-remote', '--tags', remote], { allowFailure: true });
  if (raw === undefined) {
    return undefined;
  }

  const tags = new Set();
  for (const line of raw.split('\n')) {
    if (!line.trim()) {
      continue;
    }

    const [, ref = ''] = line.split(/\s+/);
    if (!ref.startsWith('refs/tags/')) {
      continue;
    }

    tags.add(ref.replace(/^refs\/tags\//, '').replace(/\^\{\}$/, ''));
  }

  return tags.size;
}

function printCountObjects() {
  const raw = git(['count-objects', '-vH']);
  for (const line of raw.split('\n')) {
    if (!line.includes(':')) {
      console.log(line);
      continue;
    }

    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    console.log(`${colors.bold(key.trim().padEnd(14))}: ${value}`);
  }
}

/**
 * Print table.
 *
 * @param {{bytes: number, human: string, path: string}[]} rows rows value.
 * @returns {void} No return value.
 */
function printTable(rows) {
  if (rows.length === 0) {
    console.log(colors.dim('(no data)'));
    return;
  }

  const headers = ['bytes', 'human', 'path'];
  const byteWidth = Math.max(headers[0].length, ...rows.map((row) => String(row.bytes).length));
  const humanWidth = Math.max(headers[1].length, ...rows.map((row) => row.human.length));
  const byteHeader = colors.bold(colors.yellow(headers[0].padStart(byteWidth)));
  const humanHeader = colors.bold(colors.yellow(headers[1].padStart(humanWidth)));
  const pathHeader = colors.bold(colors.yellow(headers[2]));

  console.log(`${byteHeader}  ${humanHeader}  ${pathHeader}`);
  for (const row of rows) {
    const bytes = String(row.bytes).padStart(byteWidth);
    const human = row.human.padStart(humanWidth);
    console.log(`${colors.cyan(bytes)}  ${human}  ${row.path}`);
  }
}

/**
 * Get largest blobs.
 *
 * @param {number} topN topN value.
 * @returns {{bytes: number, human: string, path: string}[]} The result.
 */
function getLargestBlobs(topN) {
  const objects = git(['rev-list', '--objects', '--all']);
  const raw = git(['cat-file', '--batch-check=%(objecttype)|%(objectsize)|%(rest)'], { input: `${objects}\n` });
  const rows = [];

  for (const line of raw.split('\n')) {
    if (!line.trim()) {
      continue;
    }

    const [type, sizeRaw, ...pathParts] = line.split('|');
    if (type !== 'blob') {
      continue;
    }

    const filePath = pathParts.join('\t').trim();
    if (!filePath) {
      continue;
    }

    const bytes = Number(sizeRaw);
    rows.push({ bytes, human: humanBytes(bytes), path: filePath });
  }

  rows.sort((left, right) => right.bytes - left.bytes || left.path.localeCompare(right.path));
  return rows.slice(0, topN);
}

/**
 * Get largest head files.
 *
 * @param {number} topN topN value.
 * @returns {{bytes: number, human: string, path: string}[]} The result.
 */
function getLargestHeadFiles(topN) {
  const raw = git(['ls-tree', '-r', '--long', 'HEAD']);
  const rows = [];

  for (const line of raw.split('\n')) {
    if (!line.trim()) {
      continue;
    }

    const match = line.match(/^\d+\s+\w+\s+[0-9a-f]+\s+(\d+)\t(.+)$/i);
    if (!match) {
      continue;
    }

    const bytes = Number(match[1]);
    const filePath = match[2];
    rows.push({ bytes, human: humanBytes(bytes), path: filePath });
  }

  rows.sort((left, right) => right.bytes - left.bytes || left.path.localeCompare(right.path));
  return rows.slice(0, topN);
}

function getUniqueHistoryPathCount() {
  const raw = git(['rev-list', '--objects', '--all']);
  const paths = new Set();
  for (const line of raw.split('\n')) {
    const match = line.match(/^[0-9a-f]+\s+(.+)$/i);
    if (match) {
      paths.add(match[1]);
    }
  }
  return paths.size;
}

/**
 * Print the repository status.
 *
 * @param {string[]} args Command line arguments.
 * @returns {number} The exit code.
 */
function run(args) {
  const parsedArgs = parseArgs(args);
  if (!parsedArgs) {
    return 0;
  }
  const { dryRun, topN, remote } = parsedArgs;

  if (dryRun) {
    console.log(`[dry-run] Would report the repository status (top ${topN}, remote ${remote}).`);
    return 0;
  }

  if (git(['rev-parse', '--is-inside-work-tree'], { allowFailure: true }) === undefined) {
    fail('Not a git repository.');
  }

  section('Repository status');
  const repoRoot = git(['rev-parse', '--show-toplevel']);
  const repoName = repoRoot.split(/[\\/]/).findLast(Boolean) ?? repoRoot;
  const branch = git(['branch', '--show-current'], { allowFailure: true }) || '(detached)';
  const head = git(['rev-parse', '--short', 'HEAD']);
  const dirty = git(['status', '--porcelain']) ? 'yes' : 'no';
  printKeyValue('Repo:', repoName, colors.bold);
  printKeyValue('Branch:', branch);
  printKeyValue('HEAD:', head, colors.cyan);
  printKeyValue('Dirty:', dirty, dirty === 'yes' ? colors.yellow : colors.green);
  printKeyValue('Remote:', remote);
  console.log();

  section('Object database size');
  printCountObjects();
  console.log();

  section('Tag reachability');
  const tagOnlyCount = git(['rev-list', '--tags', '--not', '--branches', '--count'], { allowFailure: true }) || '0';
  printKeyValue('Tag-only commits (should be 0):', tagOnlyCount, Number(tagOnlyCount) === 0 ? colors.green : colors.yellow);
  if (git(['remote', 'get-url', remote], { allowFailure: true }) === undefined) {
    printKeyValue('Remote tag count:', '(remote not found)', colors.yellow);
  } else {
    const remoteTagCount = parseRemoteTagCount(remote);
    printKeyValue(`Remote tag count (${remote}):`, remoteTagCount ?? '(remote query failed)');
  }
  console.log();

  section('Integrity check (fsck)');
  const fsckResult = spawnSync('git', ['fsck', '--full', '--no-reflogs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  if (fsckResult.status !== 0) {
    console.log(colors.red('fsck: PROBLEMS FOUND'));
    const verboseFsck = [fsckResult.stderr?.trim(), fsckResult.stdout?.trim()].filter(Boolean).join('\n');
    if (verboseFsck) {
      console.log();
      console.log(verboseFsck);
    }
    return 2;
  }

  console.log(colors.green('fsck: OK'));
  console.log();

  section(`Largest blobs ever committed (history-wide, top ${topN})`);
  printTable(getLargestBlobs(topN));
  console.log();

  section(`Largest files in HEAD (current tree, top ${topN})`);
  printTable(getLargestHeadFiles(topN));
  console.log();

  section('History summary');
  printKeyValue('Unique paths ever in history:', getUniqueHistoryPathCount(), colors.bold);
  console.log();
  return 0;
}

/**
 * Print the repository status and report the failures.
 *
 * @param {string[]} [args] Command line arguments, without the runtime and script paths.
 * @returns {number} The exit code.
 */
export function main(args = process.argv.slice(2)) {
  if (args.includes('--version') || args.includes('-v')) {
    console.log(scriptVersion);
    return 0;
  }

  try {
    return run(args);
  } catch (error) {
    if (error instanceof ExitError) {
      if (error.message) {
        console.error(colors.red(error.message));
      }
      return error.code;
    }
    console.error(colors.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

// `import.meta.main` needs Node.js 22.18 or 24.2; older runtimes fall back to comparing the executed script path.
if (import.meta.main ?? path.resolve(process.argv[1] ?? '') === import.meta.filename) process.exitCode = main();
