/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable no-console */

import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';

class ExitError extends Error {
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
  ].join('\n');
}

function createColors() {
  const enabled = process.stdout.isTTY && !process.env.NO_COLOR;
  if (!enabled) {
    return {
      bold: (value) => value,
      cyan: (value) => value,
      dim: (value) => value,
      green: (value) => value,
      red: (value) => value,
      yellow: (value) => value,
    };
  }

  return {
    bold: (value) => `\u001B[1m${value}\u001B[22m`,
    cyan: (value) => `\u001B[36m${value}\u001B[39m`,
    dim: (value) => `\u001B[2m${value}\u001B[22m`,
    green: (value) => `\u001B[32m${value}\u001B[39m`,
    red: (value) => `\u001B[31m${value}\u001B[39m`,
    yellow: (value) => `\u001B[33m${value}\u001B[39m`,
  };
}

const colors = createColors();

function lineWidth() {
  return Math.min(120, Math.max(60, process.stdout.columns || 80));
}

function hr() {
  console.log(colors.dim('-'.repeat(lineWidth())));
}

function section(title) {
  hr();
  console.log(colors.bold(colors.cyan(title)));
  hr();
}

function fail(message, code = 1) {
  throw new ExitError(message, code);
}

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage());
    return undefined;
  }

  const knownFlags = new Set(['--dry-run', '-n']);
  const flags = argv.filter((value) => value.startsWith('-'));
  const unknownFlags = flags.filter((value) => !knownFlags.has(value));
  const dryRun = flags.some((value) => knownFlags.has(value));
  if (unknownFlags.length > 0) {
    fail(`Unknown option(s): ${unknownFlags.join(', ')}\n\n${usage()}`);
  }

  const positional = argv.filter((value) => !value.startsWith('-'));
  const [keepPrefix, remote = 'origin'] = positional;
  if (!keepPrefix) {
    fail(usage());
  }

  return { dryRun, keepPrefix, remote };
}

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

function git(args, options = {}) {
  return runGit(args, options).stdout;
}

function printKeyValue(key, value, colorizer) {
  const renderedValue = colorizer ? colorizer(String(value)) : String(value);
  console.log(`${key.padEnd(14)} ${renderedValue}`);
}

function chunk(items, size) {
  const groups = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

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

  return Array.from(tags).sort((left, right) => left.localeCompare(right));
}

function printTagTable(tags, colorizer = (value) => value) {
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
    const answer = await new Promise((resolve) => {
      reader.question(colors.bold(colors.yellow('Proceed? [y/N] ')), resolve);
    });
    return answer.trim().toLowerCase() === 'y';
  } finally {
    reader.close();
  }
}

function deleteRemoteTags(remote, tags) {
  for (const group of chunk(tags, 50)) {
    console.log(colors.bold(colors.yellow(`Deleting ${group.length} remote tag(s)...`)));
    runGit(['push', remote, '--delete', ...group], { inherit: true });
  }
}

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

async function main() {
  const parsedArgs = parseArgs(process.argv.slice(2));
  if (!parsedArgs) {
    return;
  }

  const { dryRun, keepPrefix, remote } = parsedArgs;

  if (git(['rev-parse', '--is-inside-work-tree'], { allowFailure: true }) === undefined) {
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
    return;
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
    return;
  }

  section('Tags To Delete');
  printTagTable(tagsToDelete, colors.yellow);
  console.log();

  if (dryRun) {
    printPlannedCommands(remote, tagsToDelete);
    return;
  }

  const confirmed = await confirmPrompt();
  if (!confirmed) {
    console.log(colors.red('Aborted.'));
    process.exitCode = 1;
    return;
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
        .sort((left, right) => left.localeCompare(right))
    : [];
  printTagTable(localTags, colors.green);
}

try {
  await main();
} catch (error) {
  if (error instanceof ExitError) {
    if (error.message) {
      console.error(colors.red(error.message));
    }
    process.exitCode = error.code;
  } else {
    console.error(colors.red(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  }
}
