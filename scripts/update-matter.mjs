/**
 * update-matter.mjs
 * Version: 1.0.0
 *
 * Updates @matter/main for the root package and every workspace that already
 * declares @matter/main or one of the obsolete split @matter packages.
 * Dependency placement is preserved for each package.
 *
 * Usage:
 *   node scripts/update-matter.mjs <latest|dev|loc> [--dry-run]
 */

/* eslint-disable no-console */
/* eslint-disable jsdoc/require-jsdoc */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MATTER_MAIN = '@matter/main';
const OBSOLETE_MATTER_PACKAGES = ['@matter/general', '@matter/model', '@matter/node', '@matter/nodejs', '@matter/protocol', '@matter/types'];
const DEPENDENCY_FIELDS = new Map([
  ['dependencies', []],
  ['devDependencies', ['--save-dev']],
  ['optionalDependencies', ['--save-optional']],
  ['peerDependencies', ['--save-peer']],
]);

function usage() {
  return [
    'Usage: node scripts/update-matter.mjs <latest|dev|loc> [--dry-run]',
    '',
    'Modes:',
    '  latest  Install @matter/main@latest',
    '  dev     Install @matter/main@dev',
    '  loc     Install ../matter.js/packages/main and its sibling split packages (general, model, node, nodejs, protocol, types)',
    '',
    'Options:',
    '  --dry-run, -n  Print discovered consumers and commands without running them',
  ].join('\n');
}

function getWorkspacePatterns(rootPackage) {
  const workspaces = rootPackage?.workspaces;
  if (Array.isArray(workspaces)) return workspaces;
  if (workspaces && typeof workspaces === 'object' && Array.isArray(workspaces.packages)) return workspaces.packages;
  return [];
}

function hasGlobChars(pattern) {
  return /[*?[\]]/.test(pattern);
}

async function findWorkspacePackageJsonPaths(repoRoot, patterns) {
  const packageJsonPaths = [];
  const globPatterns = [];

  for (const pattern of patterns.map((value) => String(value).replaceAll('\\', '/').replace(/\/$/, '')).filter(Boolean)) {
    if (hasGlobChars(pattern)) globPatterns.push(`${pattern}/package.json`);
    else packageJsonPaths.push(path.resolve(repoRoot, pattern, 'package.json'));
  }

  if (globPatterns.length > 0) {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- this script always runs on current LTS
    for await (const match of fs.glob(globPatterns, { cwd: repoRoot, exclude: (entry) => entry.split(/[\\/]/).includes('node_modules') })) {
      packageJsonPaths.push(path.resolve(repoRoot, match));
    }
  }

  const uniquePaths = [...new Set(packageJsonPaths)];
  for (const packageJsonPath of uniquePaths) {
    try {
      const stat = await fs.stat(packageJsonPath);
      if (!stat.isFile()) throw new Error('not a file');
    } catch {
      throw new Error(`Workspace package.json not found: ${path.relative(repoRoot, packageJsonPath).replaceAll('\\', '/')}`);
    }
  }
  return uniquePaths;
}

function dependencyField(pkg) {
  const fields = [...DEPENDENCY_FIELDS.keys()].filter(
    (field) => Object.hasOwn(pkg[field] || {}, MATTER_MAIN) || OBSOLETE_MATTER_PACKAGES.some((dependency) => Object.hasOwn(pkg[field] || {}, dependency)),
  );
  if (fields.length > 1) throw new Error(`${pkg.name} declares Matter packages in multiple dependency fields: ${fields.join(', ')}`);
  return fields[0];
}

function runCommand(repoRoot, dryRun, command, args) {
  console.log(`$ ${command} ${args.map((arg) => JSON.stringify(arg)).join(' ')}`);
  if (dryRun) return;

  const needsCommandShim = process.platform === 'win32' && (command === 'npm' || command === 'npx');
  const executable = needsCommandShim ? process.env.ComSpec || 'cmd.exe' : command;
  const commandArgs = needsCommandShim ? ['/d', '/s', '/c', command, ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd: repoRoot, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed (exit ${result.status}): ${command} ${args.join(' ')}`);
}

function selectionArgs(consumers) {
  const args = consumers.filter((consumer) => !consumer.root).flatMap((consumer) => ['--workspace', consumer.workspacePath]);
  if (consumers.some((consumer) => consumer.root)) args.push('--include-workspace-root');
  return args;
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-n');
const positional = args.filter((arg) => !arg.startsWith('-'));
const unknownFlags = args.filter((arg) => arg.startsWith('-') && !['--dry-run', '-n'].includes(arg));
const mode = positional[0];

if (unknownFlags.length > 0 || positional.length !== 1 || !['latest', 'dev', 'loc'].includes(mode)) {
  console.error(usage());
  process.exit(1);
}

const filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(filename), '..');
const rootPackageJsonPath = path.join(repoRoot, 'package.json');
const rootPackage = JSON.parse(await fs.readFile(rootPackageJsonPath, 'utf8'));
const workspacePackageJsonPaths = await findWorkspacePackageJsonPaths(repoRoot, getWorkspacePatterns(rootPackage));
const packageJsonPaths = [rootPackageJsonPath, ...workspacePackageJsonPaths];
const consumers = [];

for (const packageJsonPath of packageJsonPaths) {
  const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  const field = dependencyField(pkg);
  if (!field) continue;
  const root = packageJsonPath === rootPackageJsonPath;
  consumers.push({
    field,
    name: pkg.name,
    root,
    workspacePath: root ? null : path.relative(repoRoot, path.dirname(packageJsonPath)).replaceAll('\\', '/'),
    hasObsolete: OBSOLETE_MATTER_PACKAGES.some((dependency) => [...DEPENDENCY_FIELDS.keys()].some((key) => Object.hasOwn(pkg[key] || {}, dependency))),
  });
}

if (consumers.length === 0) throw new Error(`No packages declare ${MATTER_MAIN} or obsolete split Matter packages`);

console.log(`Matter target: ${mode}`);
for (const consumer of consumers) console.log(`  ${consumer.name}: ${consumer.field}`);

const obsoleteConsumers = consumers.filter((consumer) => consumer.hasObsolete);
if (obsoleteConsumers.length > 0) {
  runCommand(repoRoot, dryRun, 'npm', [...selectionArgs(obsoleteConsumers), 'uninstall', ...OBSOLETE_MATTER_PACKAGES, '--no-fund', '--no-audit']);
}

// @matter/main's package.json declares its split-package dependencies (@matter/general, @matter/node, etc.) as "*",
// which only resolves inside the matter.js monorepo workspace. Installed standalone via a local file: path, those
// packages are unpublished and unresolvable, so `loc` mode must also install them from their local sibling paths.
const targets =
  mode === 'loc'
    ? ['../matter.js/packages/main', ...OBSOLETE_MATTER_PACKAGES.map((dependency) => `../matter.js/packages/${dependency.slice('@matter/'.length)}`)]
    : [`${MATTER_MAIN}@${mode}`];
for (const [field, saveArgs] of DEPENDENCY_FIELDS) {
  const fieldConsumers = consumers.filter((consumer) => consumer.field === field);
  if (fieldConsumers.length === 0) continue;
  runCommand(repoRoot, dryRun, 'npm', [...selectionArgs(fieldConsumers), 'install', '--no-fund', '--no-audit', '--save-exact', ...saveArgs, ...targets]);
}

runCommand(repoRoot, dryRun, 'npm', ['run', 'softReset']);
