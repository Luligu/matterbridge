/**
 * bun-exports.mjs
 * Version: 1.0.0
 *
 * Adds or removes Bun export conditions from the root package and all workspace packages.
 *
 * Usage:
 *   node scripts/bun-exports.mjs [--remove] [--dry-run]
 */

/* eslint-disable no-console */
/* eslint-disable jsdoc/require-jsdoc */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function usage() {
  return [
    'Usage: node scripts/bun-exports.mjs [--remove] [--dry-run]',
    '',
    'What it does:',
    '  1) Reads the root package.json and all workspace package.json files',
    '  2) Adds each exports condition "bun" value from "import"',
    '  3) Or removes existing "bun" export conditions when --remove is set',
    '',
    'Options:',
    '  --remove, -r  Remove Bun export conditions instead of adding them',
    '  --dry-run, -n Print changes but do not write files',
  ].join('\n');
}

function normalizeGlobPath(p) {
  return String(p ?? '').replaceAll('\\\\', '/');
}

function uniqueStrings(items) {
  return [...new Set(items.filter(Boolean))];
}

function readJson(text, filePathForErrors) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON in ${filePathForErrors}: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
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

  const globMatches = [];
  if (globPatterns.length > 0) {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- this script always runs on current LTS
    for await (const match of fs.glob(globPatterns, {
      cwd: repoRoot,
      exclude: (entry) => entry.split(/[\\/]/).includes('node_modules'),
    })) {
      globMatches.push(match);
    }
  }

  const all = uniqueStrings([...resolvedPaths, ...globMatches.map((rel) => path.resolve(repoRoot, rel))]);

  for (const p of all) {
    try {
      const st = await fs.stat(p);
      if (!st.isFile()) throw new Error('not a file');
    } catch {
      throw new Error(`Workspace package.json not found: ${path.relative(repoRoot, p).replaceAll('\\\\', '/')}`);
    }
  }

  return all;
}

function formatRelPath(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).replaceAll('\\', '/');
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function importToBunTarget(importTarget) {
  if (typeof importTarget !== 'string') return undefined;
  if (!importTarget.startsWith('./dist/') || !importTarget.endsWith('.js')) return undefined;
  return `./src/${importTarget.slice('./dist/'.length, -'.js'.length)}.ts`;
}

function withBunFirst(condition, bunTarget) {
  const next = { bun: bunTarget };

  for (const [key, value] of Object.entries(condition)) {
    if (key === 'bun') continue;
    next[key] = value;
  }

  return next;
}

function addBunExports(pkg, relPath, prefix) {
  const exportsField = pkg?.exports;
  const changes = [];
  const warnings = [];

  if (!isRecord(exportsField)) return { changed: false, changes, warnings };

  for (const [exportPath, condition] of Object.entries(exportsField)) {
    const keyPath = `exports[${JSON.stringify(exportPath)}].bun`;

    if (!isRecord(condition)) {
      warnings.push(`${prefix}${relPath}: ${keyPath}: skipped non-object export entry`);
      continue;
    }

    const bunTarget = importToBunTarget(condition.import);
    if (!bunTarget) {
      warnings.push(`${prefix}${relPath}: ${keyPath}: skipped missing or unsupported import target`);
      continue;
    }

    const currentBun = condition.bun;
    const keys = Object.keys(condition);
    const isBunFirst = keys[0] === 'bun';

    if (currentBun === bunTarget && isBunFirst) continue;

    exportsField[exportPath] = withBunFirst(condition, bunTarget);
    changes.push({ keyPath, oldValue: currentBun, newValue: bunTarget });
  }

  return { changed: changes.length > 0, changes, warnings };
}

function removeBunExports(pkg, relPath, prefix) {
  const exportsField = pkg?.exports;
  const changes = [];
  const warnings = [];

  if (!isRecord(exportsField)) return { changed: false, changes, warnings };

  for (const [exportPath, condition] of Object.entries(exportsField)) {
    const keyPath = `exports[${JSON.stringify(exportPath)}].bun`;

    if (!isRecord(condition)) {
      warnings.push(`${prefix}${relPath}: ${keyPath}: skipped non-object export entry`);
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(condition, 'bun')) continue;

    const { bun, ...nextCondition } = condition;
    exportsField[exportPath] = nextCondition;
    changes.push({ keyPath, oldValue: bun, newValue: undefined });
  }

  return { changed: changes.length > 0, changes, warnings };
}

function logChange(prefix, relPath, keyPath, oldValue, newValue) {
  console.log(`${prefix}${relPath}: ${keyPath}: ${String(oldValue)} -> ${String(newValue)}`);
}

const args = process.argv.slice(2);
const knownFlags = new Set(['--dry-run', '-n', '--remove', '-r']);
const unknownFlags = args.filter((a) => a.startsWith('-') && !knownFlags.has(a));
if (unknownFlags.length > 0) {
  console.error(`Unknown option(s): ${unknownFlags.join(', ')}`);
  console.error(usage());
  process.exitCode = 1;
  throw new Error('Unknown option(s).');
}

const dryRun = args.includes('--dry-run') || args.includes('-n');
const remove = args.includes('--remove') || args.includes('-r');

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const repoRoot = path.resolve(dirname, '..');
const rootPackageJsonPath = path.join(repoRoot, 'package.json');

const rootRaw = await fs.readFile(rootPackageJsonPath, 'utf8');
const rootPkg = readJson(rootRaw, rootPackageJsonPath);

const workspacePatterns = getWorkspacePatterns(rootPkg);
const workspacePackageJsonPaths = await findWorkspacePackageJsonPaths(repoRoot, workspacePatterns);
const targetPackageJsonPaths = uniqueStrings([rootPackageJsonPath, ...workspacePackageJsonPaths]);

let changedFiles = 0;
let updatedExports = 0;
let skippedExports = 0;

for (const packageJsonPath of targetPackageJsonPaths) {
  const raw = await fs.readFile(packageJsonPath, 'utf8');
  const pkg = readJson(raw, packageJsonPath);
  const relPath = formatRelPath(repoRoot, packageJsonPath);
  const prefix = dryRun ? '[dry-run] ' : '';
  const result = remove ? removeBunExports(pkg, relPath, prefix) : addBunExports(pkg, relPath, prefix);

  for (const warning of result.warnings) {
    console.warn(warning);
  }
  skippedExports += result.warnings.length;

  if (!result.changed) continue;

  changedFiles++;
  updatedExports += result.changes.length;

  for (const c of result.changes) {
    logChange(prefix, relPath, c.keyPath, c.oldValue, c.newValue);
  }

  if (dryRun) {
    console.log(`[dry-run] would write: ${relPath}`);
  } else {
    await fs.writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    console.log(`wrote: ${relPath}`);
  }
}

console.log('');
console.log(`workspace package.json files: ${workspacePackageJsonPaths.length}`);
console.log(`target package.json files: ${targetPackageJsonPaths.length}`);
console.log(`changed files: ${changedFiles}`);
console.log(`${remove ? 'removed' : 'updated'} exports: ${updatedExports}`);
console.log(`skipped exports: ${skippedExports}`);

if (dryRun) {
  console.log('');
  console.log('[dry-run] No files were written.');
}
