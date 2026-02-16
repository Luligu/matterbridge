/* eslint-disable no-console */
/* eslint-disable jsdoc/require-jsdoc */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { glob } from 'glob';

function usage() {
  return [
    'Usage: node scripts/sync-workspaces.mjs [--scope <prefix>] [--dry-run]',
    '',
    'What it does:',
    '  1) Reads the root package.json version',
    '  2) Sets the version of every workspace package to that version',
    '  3) Updates dependency versions in the root + workspace package.json files for packages whose name starts with <prefix>',
    '',
    'Options:',
    '  --scope, -s   Dependency name prefix to rewrite (default: @matterbridge)',
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

  const globMatches =
    globPatterns.length > 0
      ? await glob(globPatterns, {
          cwd: repoRoot,
          windowsPathsNoEscape: true,
          ignore: ['**/node_modules/**'],
        })
      : [];

  const all = uniqueStrings([...resolvedPaths, ...globMatches.map((rel) => path.resolve(repoRoot, rel))]);

  // Validate all workspace entries resolve to an existing package.json.
  // This prevents silently missing a workspace when the config is wrong.
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

function rewriteDeps(pkg, scopePrefix, nextVersion) {
  const depFields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
  const changes = [];

  for (const field of depFields) {
    const deps = pkg[field];
    if (!deps || typeof deps !== 'object') continue;

    for (const depName of Object.keys(deps)) {
      if (!depName.startsWith(scopePrefix)) continue;

      const oldValue = deps[depName];
      if (oldValue !== nextVersion) {
        deps[depName] = nextVersion;
        changes.push({ field, depName, oldValue, newValue: nextVersion });
      }
    }
  }

  return changes;
}

function setVersion(pkg, nextVersion) {
  if (!pkg || typeof pkg !== 'object') return null;
  const current = pkg.version;
  if (current !== nextVersion) {
    pkg.version = nextVersion;
    return { oldValue: current, newValue: nextVersion };
  }
  return null;
}

function formatRelPath(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).replaceAll('\\', '/');
}

function logChange(prefix, relPath, keyPath, oldValue, newValue) {
  console.log(`${prefix}${relPath}: ${keyPath}: ${String(oldValue)} -> ${String(newValue)}`);
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

const rootVersion = String(rootPkg?.version ?? '').trim();
if (!rootVersion) {
  throw new Error('Root package.json version is missing/empty.');
}

const workspacePatterns = getWorkspacePatterns(rootPkg);
const workspacePackageJsonPaths = await findWorkspacePackageJsonPaths(repoRoot, workspacePatterns);
const workspacePackageJsonSet = new Set(workspacePackageJsonPaths.map((p) => path.resolve(p)));

const targetPackageJsonPaths = uniqueStrings([rootPackageJsonPath, ...workspacePackageJsonPaths]);

let changedFiles = 0;
let updatedWorkspaceVersions = 0;
let updatedDependencies = 0;

for (const packageJsonPath of targetPackageJsonPaths) {
  const raw = await fs.readFile(packageJsonPath, 'utf8');
  const pkg = readJson(raw, packageJsonPath);

  let changed = false;
  const relPath = formatRelPath(repoRoot, packageJsonPath);
  const prefix = dryRun ? '[dry-run] ' : '';

  if (workspacePackageJsonSet.has(path.resolve(packageJsonPath))) {
    const vChange = setVersion(pkg, rootVersion);
    if (vChange) {
      logChange(prefix, relPath, 'version', vChange.oldValue, vChange.newValue);
      updatedWorkspaceVersions++;
      changed = true;
    }
  }

  const depChanges = rewriteDeps(pkg, scopePrefix, rootVersion);
  if (depChanges.length > 0) {
    for (const c of depChanges) {
      logChange(prefix, relPath, `${c.field}.${c.depName}`, c.oldValue, c.newValue);
    }
    updatedDependencies++;
    changed = true;
  }

  if (changed) {
    changedFiles++;
    if (dryRun) {
      console.log(`[dry-run] would write: ${relPath}`);
    } else {
      await fs.writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
      console.log(`wrote: ${relPath}`);
    }
  }
}

console.log('');
console.log(`root version: ${rootVersion}`);
console.log(`scope prefix: ${scopePrefix}`);
console.log(`workspace package.json files: ${workspacePackageJsonPaths.length}`);
console.log(`target package.json files: ${targetPackageJsonPaths.length}`);
console.log(`changed files: ${changedFiles}`);
console.log(`workspace versions updated: ${updatedWorkspaceVersions}`);
console.log(`package.json files with dependency rewrites: ${updatedDependencies}`);

if (dryRun) {
  console.log('');
  console.log('[dry-run] No files were written.');
}
