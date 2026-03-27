/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable no-console */

import { spawnSync } from 'node:child_process';

class ExitError extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

function usage() {
  return [
    'Usage: node scripts/git-status.mjs [topN] [remote]',
    '',
    'Examples:',
    '  node scripts/git-status.mjs',
    '  node scripts/git-status.mjs 50',
    '  node scripts/git-status.mjs 100 origin',
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

  const [topNArg = '30', remote = 'origin'] = argv;
  if (!/^\d+$/.test(topNArg) || Number(topNArg) <= 0) {
    fail(`Invalid topN value: ${JSON.stringify(topNArg)}\n\n${usage()}`);
  }

  return {
    remote,
    topN: Number(topNArg),
  };
}

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

function humanBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = Number(bytes);
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

function printKeyValue(key, value, colorizer) {
  const renderedValue = colorizer ? colorizer(String(value)) : String(value);
  console.log(`${key.padEnd(12)} ${renderedValue}`);
}

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

    const path = pathParts.join('\t').trim();
    if (!path) {
      continue;
    }

    const bytes = Number(sizeRaw);
    rows.push({ bytes, human: humanBytes(bytes), path });
  }

  rows.sort((left, right) => right.bytes - left.bytes || left.path.localeCompare(right.path));
  return rows.slice(0, topN);
}

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
    const path = match[2];
    rows.push({ bytes, human: humanBytes(bytes), path });
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

function main() {
  const parsedArgs = parseArgs(process.argv.slice(2));
  if (!parsedArgs) {
    return;
  }
  const { topN, remote } = parsedArgs;

  if (git(['rev-parse', '--is-inside-work-tree'], { allowFailure: true }) === undefined) {
    fail('Not a git repository.');
  }

  section('Repository status');
  const repoRoot = git(['rev-parse', '--show-toplevel']);
  const repoName = repoRoot.split(/[\\/]/).filter(Boolean).pop() || repoRoot;
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
  if (git(['remote', 'get-url', remote], { allowFailure: true }) !== undefined) {
    const remoteTagCount = parseRemoteTagCount(remote);
    printKeyValue(`Remote tag count (${remote}):`, remoteTagCount ?? '(remote query failed)');
  } else {
    printKeyValue('Remote tag count:', '(remote not found)', colors.yellow);
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
    process.exitCode = 2;
    return;
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
}

try {
  main();
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
