/**
 * prune-tags.mjs
 * Version: 2.0.0
 *
 * Deletes old remote git tags that do not match a given prefix.
 *
 * Usage:
 *   node scripts/prune-tags.mjs --version, -v  Show the script version
 *   node scripts/prune-tags.mjs [--dry-run|-n] <tag-prefix-to-keep> [remote]
 *
 * The script runs only when executed directly. Importing it exposes `main` without side effects.
 */

/* oxlint-disable no-console */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';

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
    'Usage: node scripts/prune-tags.mjs [--dry-run|-n] <tag-prefix-to-keep> [remote]',
    '',
    'Examples:',
    '  node scripts/prune-tags.mjs 2.',
    '  node scripts/prune-tags.mjs 2. origin',
    '  node scripts/prune-tags.mjs --dry-run 2. origin',
    '',
    '  --version, -v  Show the script version',
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
 * @returns {{dryRun: boolean, keepPrefix: string, remote: string} | undefined} The result.
 */
function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage());
    // oxlint-disable-next-line unicorn/no-useless-undefined
    return undefined;
  }

  const knownFlags = new Set(['--dry-run', '-n']);
  const flags = argv.filter((/** @type {string} */ value) => value.startsWith('-'));
  const unknownFlags = flags.filter((/** @type {string} */ value) => !knownFlags.has(value));
  const dryRun = flags.some((/** @type {string} */ value) => knownFlags.has(value));
  if (unknownFlags.length > 0) {
    fail(`Unknown option(s): ${unknownFlags.join(', ')}\n\n${usage()}`);
  }

  const positional = argv.filter((/** @type {string} */ value) => !value.startsWith('-'));
  const [keepPrefix, remote = 'origin'] = positional;
  if (!keepPrefix) {
    fail(usage());
  }

  return { dryRun, keepPrefix, remote };
}

/**
 * Run git.
 *
 * @param {string[]} args args value.
 * @param {{allowFailure?: boolean, input?: string, inherit?: boolean}} [options] options value.
 * @returns {{status: number, stdout: string, stderr: string}} The result.
 */
// oxlint-disable-next-line typescript/consistent-return -- ends with fail(), which always throws
function runGit(args, options = {}) {
  const { allowFailure = false, input, inherit = false } = options;
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    input,
    maxBuffer: 64 * 1024 * 1024,
    stdio: inherit ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  if (result.status === 0) {
    return {
      status: 0,
      stderr: result.stderr?.trimEnd() ?? '',
      stdout: result.stdout?.trimEnd() ?? '',
    };
  }

  if (allowFailure) {
    return {
      status: result.status ?? 1,
      stderr: result.stderr?.trimEnd() ?? '',
      stdout: result.stdout?.trimEnd() ?? '',
    };
  }

  const details = [result.stderr?.trim(), result.stdout?.trim()].filter(Boolean).join('\n');
  fail(details ? `git ${args.join(' ')} failed:\n${details}` : `git ${args.join(' ')} failed.`);
}

/**
 * Git.
 *
 * @param {string[]} args args value.
 * @param {{allowFailure?: boolean, input?: string, inherit?: boolean}} [options] options value.
 * @returns {string} The result.
 */
function git(args, options = {}) {
  return runGit(args, options).stdout;
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
  console.log(`${key.padEnd(14)} ${renderedValue}`);
}

/**
 * Chunk.
 *
 * @param {string[]} items items value.
 * @param {number} size size value.
 * @returns {string[][]} The result.
 */
function chunk(items, size) {
  const groups = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

/**
 * Parse tag names.
 *
 * @param {string} raw raw value.
 * @returns {string[]} The result.
 */
function parseTagNames(raw) {
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

  return Array.from(tags).toSorted((left, right) => left.localeCompare(right));
}

/**
 * Print tag table.
 *
 * @param {string[]} tags tags value.
 * @param {(value: string) => string} colorizer colorizer value.
 * @returns {void} No return value.
 */
function printTagTable(tags, colorizer) {
  if (tags.length === 0) {
    console.log(colors.dim('(none)'));
    return;
  }

  const indexWidth = Math.max(1, String(tags.length).length);
  const headerIndex = colors.bold(colors.yellow('#'.padStart(indexWidth)));
  const headerTag = colors.bold(colors.yellow('tag'));
  console.log(`${headerIndex}  ${headerTag}`);
  tags.forEach((tag, index) => {
    console.log(`${colors.dim(String(index + 1).padStart(indexWidth))}  ${colorizer(tag)}`);
  });
}

async function confirmPrompt() {
  const reader = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise(
      /** @param {(answer: string) => void} resolve Resolve with the answer. */ (resolve) => {
        reader.question(colors.bold(colors.yellow('Proceed? [y/N] ')), resolve);
      },
    );
    return answer.trim().toLowerCase() === 'y';
  } finally {
    reader.close();
  }
}

/**
 * Delete remote tags.
 *
 * @param {string} remote remote value.
 * @param {string[]} tags tags value.
 * @returns {void} No return value.
 */
function deleteRemoteTags(remote, tags) {
  for (const group of chunk(tags, 50)) {
    console.log(colors.bold(colors.yellow(`Deleting ${group.length} remote tag(s)...`)));
    runGit(['push', remote, '--delete', ...group], { inherit: true });
  }
}

/**
 * Print planned commands.
 *
 * @param {string} remote remote value.
 * @param {string[]} tags tags value.
 * @returns {void} No return value.
 */
function printPlannedCommands(remote, tags) {
  section('Dry Run');
  console.log(colors.green('No changes will be made.'));
  console.log();
  console.log(colors.bold(colors.yellow('Commands that would run:')));
  for (const group of chunk(tags, 50)) {
    console.log(colors.dim(`git push ${remote} --delete ${group.join(' ')}`));
  }
  console.log(colors.dim('git fetch --prune --prune-tags'));
  for (const group of chunk(tags, 50)) {
    console.log(colors.dim(`git tag -d ${group.join(' ')}`));
  }
  console.log(colors.dim('git reflog expire --expire=now --all'));
  console.log(colors.dim('git gc --prune=now'));
}

function pruneFetchedTags() {
  console.log(colors.bold(colors.yellow('Pruning local tags from remote...')));
  runGit(['fetch', '--prune', '--prune-tags'], { inherit: true });
}

/**
 * Delete local tags.
 *
 * @param {string[]} tags tags value.
 * @returns {void} No return value.
 */
function deleteLocalTags(tags) {
  for (const group of chunk(tags, 50)) {
    console.log(colors.bold(colors.yellow(`Deleting ${group.length} local tag(s) if present...`)));
    runGit(['tag', '-d', ...group], { allowFailure: true, inherit: true });
  }
}

function cleanupRepository() {
  console.log(colors.bold(colors.yellow('Expiring reflogs...')));
  runGit(['reflog', 'expire', '--expire=now', '--all'], { inherit: true });
  console.log(colors.bold(colors.yellow('Running git gc...')));
  runGit(['gc', '--prune=now'], { inherit: true });
}

/**
 * Prune the remote tags.
 *
 * @param {string[]} args Command line arguments.
 * @returns {Promise<number>} The exit code.
 */
async function run(args) {
  const parsedArgs = parseArgs(args);
  if (!parsedArgs) {
    return 0;
  }

  const { dryRun, keepPrefix, remote } = parsedArgs;

  if (runGit(['rev-parse', '--is-inside-work-tree'], { allowFailure: true }).status !== 0) {
    fail('Not a git repository.');
  }

  section('Prune Remote Tags');
  printKeyValue('Keep prefix:', keepPrefix, colors.green);
  printKeyValue('Remote:', remote, colors.bold);
  printKeyValue('Dry run:', dryRun ? 'yes' : 'no', dryRun ? colors.yellow : colors.green);
  console.log();

  const remoteTags = parseTagNames(git(['ls-remote', '--tags', remote]));
  if (remoteTags.length === 0) {
    console.log(colors.yellow(`No tags found on remote '${remote}'.`));
    return 0;
  }

  const tagsToDelete = remoteTags.filter((tag) => !tag.startsWith(keepPrefix));

  section('Summary');
  printKeyValue('Remote tags:', remoteTags.length, colors.bold);
  printKeyValue('Keeping:', remoteTags.length - tagsToDelete.length, colors.green);
  printKeyValue('Deleting:', tagsToDelete.length, tagsToDelete.length > 0 ? colors.yellow : colors.green);
  console.log();

  if (tagsToDelete.length === 0) {
    console.log(colors.green(`No tags to delete. All remote tags already match prefix '${keepPrefix}'.`));
    console.log();
    section('Remote Tags');
    printTagTable(remoteTags, colors.green);
    return 0;
  }

  section('Tags To Delete');
  printTagTable(tagsToDelete, colors.yellow);
  console.log();

  if (dryRun) {
    printPlannedCommands(remote, tagsToDelete);
    return 0;
  }

  const confirmed = await confirmPrompt();
  if (!confirmed) {
    console.log(colors.red('Aborted.'));
    return 1;
  }

  console.log();
  section('Delete Remote Tags');
  deleteRemoteTags(remote, tagsToDelete);
  console.log();

  section('Cleanup Local Tags');
  pruneFetchedTags();
  deleteLocalTags(tagsToDelete);
  console.log();

  section('Repository Cleanup');
  cleanupRepository();
  console.log();

  section('Remaining Local Tags');
  const localTagsRaw = git(['tag'], { allowFailure: true }) || '';
  const localTags = localTagsRaw
    ? localTagsRaw
        .split('\n')
        .filter(Boolean)
        .toSorted((left, right) => left.localeCompare(right))
    : [];
  printTagTable(localTags, colors.green);
  return 0;
}

/**
 * Prune the remote tags and report the failures.
 *
 * @param {string[]} [args] Command line arguments, without the runtime and script paths.
 * @returns {Promise<number>} The exit code.
 */
export async function main(args = process.argv.slice(2)) {
  if (args.includes('--version') || args.includes('-v')) {
    console.log(scriptVersion);
    return 0;
  }

  try {
    return await run(args);
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
if (import.meta.main ?? path.resolve(process.argv[1] ?? '') === import.meta.filename) process.exitCode = await main();
