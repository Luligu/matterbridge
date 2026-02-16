/* eslint-disable no-console */
/* eslint-disable jsdoc/require-jsdoc */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function usage() {
  return [
    'Usage: node scripts/bundle-workspaces.mjs [--scope <prefix>] [--dry-run]',
    '',
    'What it does:',
    '  1) Reads the root package.json dependencies',
    '  2) Finds all dependency names that start with <prefix>',
    '  3) Writes package.json bundledDependencies with those names',
    '',
    'Options:',
    '  --scope, -s   Dependency name prefix to bundle (default: @matterbridge)',
    '  --dry-run, -n Print changes but do not write files',
  ].join('\n');
}

function readJson(text, filePathForErrors) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON in ${filePathForErrors}: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }
}

function formatRelPath(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).replaceAll('\\', '/');
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function logChange(prefix, relPath, keyPath, oldValue, newValue) {
  console.log(`${prefix}${relPath}: ${keyPath}: ${String(oldValue)} -> ${String(newValue)}`);
}

function computeBundledDependencies(pkg, scopePrefix) {
  const deps = pkg?.dependencies;
  if (!deps || typeof deps !== 'object') return [];
  return Object.keys(deps).filter((name) => name.startsWith(scopePrefix));
}

const args = process.argv.slice(2);
const knownFlags = new Set(['--dry-run', '-n', '--scope', '-s']);
const unknownFlags = args.filter((a) => a.startsWith('-') && !knownFlags.has(a));
if (unknownFlags.length > 0) {
  console.error(`Unknown option(s): ${unknownFlags.join(', ')}`);
  console.error(usage());
  process.exitCode = 1;
  throw new Error('Unknown option(s).');
}

const dryRun = args.includes('--dry-run') || args.includes('-n');
let scopePrefix = '@matterbridge';

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
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const rootPackageJsonPath = path.join(repoRoot, 'package.json');

const rootRaw = await fs.readFile(rootPackageJsonPath, 'utf8');
const rootPkg = readJson(rootRaw, rootPackageJsonPath);

const relPath = formatRelPath(repoRoot, rootPackageJsonPath);
const prefix = dryRun ? '[dry-run] ' : '';

const nextBundled = computeBundledDependencies(rootPkg, scopePrefix);
const currentBundled = Array.isArray(rootPkg?.bundledDependencies) ? rootPkg.bundledDependencies : undefined;

console.log(`${prefix}bundledDependencies found (${nextBundled.length}):`);
for (const name of nextBundled) {
  console.log(`${prefix}- ${name}`);
}

let changed = false;

if (!arraysEqual(currentBundled ?? [], nextBundled)) {
  logChange(prefix, relPath, 'bundledDependencies', JSON.stringify(currentBundled ?? []), JSON.stringify(nextBundled));

  if (nextBundled.length > 0) {
    rootPkg.bundledDependencies = nextBundled;
  } else {
    delete rootPkg.bundledDependencies;
  }
  changed = true;
}

if (changed) {
  if (dryRun) {
    console.log(`[dry-run] would write: ${relPath}`);
  } else {
    await fs.writeFile(rootPackageJsonPath, `${JSON.stringify(rootPkg, null, 2)}\n`, 'utf8');
    console.log(`wrote: ${relPath}`);
  }
}

console.log('');
console.log(`scope prefix: ${scopePrefix}`);
console.log(`bundledDependencies entries: ${nextBundled.length}`);
console.log(`changed: ${changed ? 1 : 0}`);

if (dryRun) {
  console.log('');
  console.log('[dry-run] No files were written.');
}
