/* eslint-disable no-console */
/* eslint-disable jsdoc/require-jsdoc */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { glob } from 'glob';

const ANSI_GREEN = '\x1b[32m';
const ANSI_RESET = '\x1b[0m';

function shouldUseColor() {
  if (process.env.NO_COLOR) return false;
  if (process.env.TERM === 'dumb') return false;
  return Boolean(process.stdout?.isTTY);
}

function green(text) {
  return shouldUseColor() ? `${ANSI_GREEN}${text}${ANSI_RESET}` : text;
}

function usage() {
  return [
    'Usage: node scripts/publish-workspaces.mjs --tag <dev|edge|git|latest> [--scope <prefix>] [--dry-run]',
    '',
    'What it does:',
    '  0) Backs up root + workspaces package.json files in-memory',
    '  1) Runs scripts/version.mjs <tag> (sets a publish version suffix; skipped when tag=latest)',
    '  2) Runs scripts/sync-workspaces.mjs (sync workspace versions + scoped deps)',
    '  3) Runs npm run buildProduction',
    '  4) Temporarily removes devDependencies, scripts, workspaces, and bundledDependencies from all package.json files',
    '  5) Publishes each workspace with npm publish (or --dry-run publish)',
    '  6) Publishes the root package with npm publish (or --dry-run publish)',
    '  7) Restores original package.json files from the in-memory backup',
    '',
    'Options:',
    '  --tag, -t    Required. One of: dev | edge | git | latest',
    '  --scope, -s  Dependency name prefix to sync/bundle (default: @matterbridge)',
    '  --dry-run, -n Only applies to publish (adds npm publish --dry-run)',
  ].join('\n');
}

function normalizeGlobPath(p) {
  return String(p ?? '').replaceAll('\\', '/');
}

function uniqueStrings(items) {
  return [...new Set(items.filter(Boolean))];
}

function readJson(text, filePathForErrors) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON in ${filePathForErrors}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function getWorkspacePatterns(rootPkg) {
  const ws = rootPkg?.workspaces;
  if (Array.isArray(ws)) return ws;
  if (ws && typeof ws === 'object' && Array.isArray(ws.packages)) return ws.packages;
  return [];
}

function hasGlobChars(pattern) {
  // eslint-disable-next-line no-useless-escape
  return /[\*\?\[\]]/.test(String(pattern ?? ''));
}

async function findWorkspacePackageJsonPaths(repoRoot, workspacePatterns) {
  const normalized = workspacePatterns.map((p) => normalizeGlobPath(p).replace(/\/$/, '')).filter(Boolean);
  if (normalized.length === 0) return [];

  const resolvedPaths = [];
  const globPatterns = [];

  for (const p of normalized) {
    if (hasGlobChars(p)) {
      globPatterns.push(`${p}/package.json`);
    } else {
      resolvedPaths.push(path.resolve(repoRoot, p, 'package.json'));
    }
  }

  const globMatches =
    globPatterns.length > 0
      ? await glob(globPatterns, {
          cwd: repoRoot,
          windowsPathsNoEscape: true,
          ignore: ['**/node_modules/**'],
        })
      : [];

  const all = uniqueStrings([...resolvedPaths, ...globMatches.map((rel) => path.resolve(repoRoot, rel))]);

  for (const p of all) {
    try {
      const st = await fs.stat(p);
      if (!st.isFile()) throw new Error('not a file');
    } catch {
      throw new Error(`Workspace package.json not found: ${path.relative(repoRoot, p).replaceAll('\\', '/')}`);
    }
  }

  return all;
}

function formatRelPath(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).replaceAll('\\', '/');
}

function logChange(prefix, relPath, keyPath, oldValue, newValue) {
  console.log(green(`${prefix}${relPath}: ${keyPath}: ${String(oldValue)} -> ${String(newValue)}`));
}

function runCmd(repoRoot, dryRun, cmd, args) {
  console.log(green(`$ ${cmd} ${args.map((a) => JSON.stringify(a)).join(' ')}`));

  const isWin = process.platform === 'win32';
  const needsCmdShim = isWin && (cmd === 'npm' || cmd === 'npx');
  const execCmd = needsCmdShim ? process.env.ComSpec || 'cmd.exe' : cmd;
  const execArgs = needsCmdShim ? ['/d', '/s', '/c', cmd, ...args] : args;

  const res = spawnSync(execCmd, execArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  });

  if (typeof res.status === 'number' && res.status !== 0) {
    throw new Error(`Command failed (exit ${res.status}): ${cmd} ${args.join(' ')}`);
  }

  if (res.error) {
    throw res.error;
  }
}

function runPublish(repoRoot, publishDryRun, args) {
  const withDryRun = publishDryRun ? [...args, '--dry-run'] : args;
  const prefix = publishDryRun ? '[publish --dry-run] ' : '';
  console.log(green(`${prefix}$ npm ${withDryRun.map((a) => JSON.stringify(a)).join(' ')}`));

  // Extra guardrails: ensure npm does not treat this invocation as a workspace/monorepo publish.
  // We already strip `workspaces` from all package.json files before publishing.
  const env = {
    ...process.env,
    npm_config_workspaces: 'false',
    npm_config_include_workspace_root: 'false',
  };

  const isWin = process.platform === 'win32';
  const cmd = isWin ? process.env.ComSpec || 'cmd.exe' : 'npm';
  const cmdArgs = isWin ? ['/d', '/s', '/c', 'npm', ...withDryRun] : withDryRun;

  const res = spawnSync(cmd, cmdArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
    env,
    shell: false,
  });

  if (typeof res.status === 'number' && res.status !== 0) {
    throw new Error(`Publish failed (exit ${res.status}): npm ${withDryRun.join(' ')}`);
  }

  if (res.error) {
    throw res.error;
  }
}

function stripPublishOnlyFields(pkg) {
  const removed = [];

  if (pkg && typeof pkg === 'object') {
    if (Object.prototype.hasOwnProperty.call(pkg, 'devDependencies')) {
      delete pkg.devDependencies;
      removed.push('devDependencies');
    }
    if (Object.prototype.hasOwnProperty.call(pkg, 'scripts')) {
      delete pkg.scripts;
      removed.push('scripts');
    }
    if (Object.prototype.hasOwnProperty.call(pkg, 'workspaces')) {
      delete pkg.workspaces;
      removed.push('workspaces');
    }
    if (Object.prototype.hasOwnProperty.call(pkg, 'bundledDependencies')) {
      delete pkg.bundledDependencies;
      removed.push('bundledDependencies');
    }
    // (Legacy/typo safety)
    if (Object.prototype.hasOwnProperty.call(pkg, 'bundleDependencies')) {
      delete pkg.bundleDependencies;
      removed.push('bundleDependencies');
    }
  }

  return removed;
}

const args = process.argv.slice(2);
const knownFlags = new Set(['--dry-run', '-n', '--scope', '-s', '--tag', '-t']);
const unknownFlags = args.filter((a) => a.startsWith('-') && !knownFlags.has(a));
if (unknownFlags.length > 0) {
  console.error(`Unknown option(s): ${unknownFlags.join(', ')}`);
  console.error(usage());
  process.exitCode = 1;
  throw new Error('Unknown option(s).');
}

const dryRun = args.includes('--dry-run') || args.includes('-n');
let scopePrefix = '@matterbridge';
let tag;

for (let i = 0; i < args.length; i++) {
  const a = args[i];

  if (a === '--scope' || a === '-s') {
    const v = args[i + 1];
    if (!v || v.startsWith('-')) {
      console.error('Missing value for --scope');
      console.error(usage());
      process.exitCode = 1;
      throw new Error('Missing --scope value.');
    }
    scopePrefix = v;
    i++;
    continue;
  }

  if (a === '--tag' || a === '-t') {
    const v = args[i + 1];
    if (!v || v.startsWith('-')) {
      console.error('Missing value for --tag');
      console.error(usage());
      process.exitCode = 1;
      throw new Error('Missing --tag value.');
    }
    tag = String(v).toLowerCase();
    i++;
    continue;
  }
}

if (tag !== 'dev' && tag !== 'edge' && tag !== 'git' && tag !== 'latest') {
  console.error(usage());
  process.exitCode = 1;
  throw new Error('Missing or invalid --tag (expected dev, edge, git, or latest).');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const rootPackageJsonPath = path.join(repoRoot, 'package.json');

const rootRaw = await fs.readFile(rootPackageJsonPath, 'utf8');
const rootPkg = readJson(rootRaw, rootPackageJsonPath);

const workspacePatterns = getWorkspacePatterns(rootPkg);
const workspacePackageJsonPaths = await findWorkspacePackageJsonPaths(repoRoot, workspacePatterns);
const targetPackageJsonPaths = uniqueStrings([rootPackageJsonPath, ...workspacePackageJsonPaths]);
const workspaceDirs = workspacePackageJsonPaths.map((p) => path.dirname(p));

const backups = new Map();

async function backupAllPackageJson() {
  backups.clear();
  for (const p of targetPackageJsonPaths) {
    backups.set(path.resolve(p), await fs.readFile(p, 'utf8'));
  }
}

async function restoreAllPackageJson() {
  for (const p of targetPackageJsonPaths) {
    const raw = backups.get(path.resolve(p));
    if (typeof raw === 'string') {
      await fs.writeFile(p, raw, 'utf8');
    }
  }
}

async function stripFieldsInAllPackageJson() {
  let changedFiles = 0;
  let removedCount = 0;
  const prefix = '';

  for (const packageJsonPath of targetPackageJsonPaths) {
    const raw = await fs.readFile(packageJsonPath, 'utf8');
    const pkg = readJson(raw, packageJsonPath);

    const relPath = formatRelPath(repoRoot, packageJsonPath);
    const removed = stripPublishOnlyFields(pkg);

    if (removed.length === 0) continue;

    removedCount += removed.length;
    changedFiles++;

    for (const key of removed) {
      logChange(prefix, relPath, key, '[present]', '[removed]');
    }

    await fs.writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    console.log(`wrote: ${relPath}`);
  }

  return { changedFiles, removedCount };
}

console.log(`tag: ${tag}`);
console.log(`scope prefix: ${scopePrefix}`);
console.log(`workspace package.json files: ${workspacePackageJsonPaths.length}`);
console.log(`target package.json files: ${targetPackageJsonPaths.length}`);
console.log(`dry-run: ${dryRun ? 'yes' : 'no'}`);
console.log('');

await backupAllPackageJson();
console.log(green('backed up: package.json files (in-memory backup)'));

try {
  const publishTag = tag;
  const shouldRunVersion = publishTag !== 'latest';

  if (shouldRunVersion) {
    runCmd(repoRoot, false, 'node', ['scripts/version.mjs', publishTag]);
  } else {
    console.log(green('skipped: scripts/version.mjs (tag=latest)'));
  }

  runCmd(repoRoot, false, 'node', ['scripts/sync-workspaces.mjs', '--scope', scopePrefix]);
  runCmd(repoRoot, false, 'npm', ['run', 'cleanBuildProduction']);

  const stripSummary = await stripFieldsInAllPackageJson();
  console.log('');
  console.log(`package.json files stripped: ${stripSummary.changedFiles}`);
  console.log(`fields removed (total): ${stripSummary.removedCount}`);
  console.log('');

  for (const dir of workspaceDirs) {
    console.log(`publishing workspace: ${formatRelPath(repoRoot, dir)}`);
    runPublish(dir, dryRun, ['publish', '--tag', publishTag]);
  }

  console.log('publishing root package: package.json');
  runPublish(repoRoot, dryRun, ['publish', '--tag', publishTag]);
} finally {
  try {
    await restoreAllPackageJson();
    console.log(green('restored: package.json files (in-memory backup)'));
  } catch (err) {
    console.error(`Warning: in-memory restore failed (${err instanceof Error ? err.message : String(err)})`);
  }
}
