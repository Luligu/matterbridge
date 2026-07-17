/**
 * bun-bins.mjs
 * Version: 1.0.0
 *
 * Rewrites shebangs in bin files from Node to Bun.
 *
 * Usage:
 *   node scripts/bun-bins.mjs [--dry-run]
 */

/* eslint-disable no-console */
/* eslint-disable jsdoc/require-jsdoc */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function usage() {
  return [
    'Usage: node scripts/bun-bins.mjs [--dry-run]',
    '',
    'What it does:',
    '  1) Reads files in the bin folder',
    '  2) Rewrites first-line shebangs from Node to Bun',
    '',
    'Options:',
    '  --dry-run, -n Print changes but do not write files',
  ].join('\n');
}

function formatRelPath(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).replaceAll('\\', '/');
}

function toBunShebang(line) {
  if (line === '#!/usr/bin/env node') return '#!/usr/bin/env bun';
  if (line === '#!/usr/bin/node') return '#!/usr/bin/bun';
  if (line === '#!/usr/local/bin/node') return '#!/usr/local/bin/bun';

  const envNodeMatch = line.match(/^#!\/usr\/bin\/env\s+-S\s+node(\b.*)$/);
  if (envNodeMatch) return `#!/usr/bin/env -S bun${envNodeMatch[1]}`;

  return undefined;
}

const args = process.argv.slice(2);
const knownFlags = new Set(['--dry-run', '-n']);
const unknownFlags = args.filter((a) => a.startsWith('-') && !knownFlags.has(a));
if (unknownFlags.length > 0) {
  console.error(`Unknown option(s): ${unknownFlags.join(', ')}`);
  console.error(usage());
  process.exitCode = 1;
  throw new Error('Unknown option(s).');
}

const dryRun = args.includes('--dry-run') || args.includes('-n');

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const repoRoot = path.resolve(dirname, '..');
const binDir = path.join(repoRoot, 'bin');

const entries = await fs.readdir(binDir, { withFileTypes: true });
const binFilePaths = entries.filter((entry) => entry.isFile()).map((entry) => path.join(binDir, entry.name));

let changedFiles = 0;
let skippedFiles = 0;

for (const binFilePath of binFilePaths) {
  const relPath = formatRelPath(repoRoot, binFilePath);
  const prefix = dryRun ? '[dry-run] ' : '';

  const raw = await fs.readFile(binFilePath, 'utf8');
  const newlineIndex = raw.indexOf('\n');
  const firstLine = newlineIndex >= 0 ? raw.slice(0, newlineIndex) : raw;
  const rest = newlineIndex >= 0 ? raw.slice(newlineIndex) : '';

  const nextShebang = toBunShebang(firstLine);
  if (!nextShebang) {
    skippedFiles++;
    console.warn(`${prefix}${relPath}: skipped missing or unsupported Node shebang`);
    continue;
  }

  if (nextShebang === firstLine) {
    skippedFiles++;
    console.warn(`${prefix}${relPath}: skipped already using Bun shebang`);
    continue;
  }

  changedFiles++;
  console.log(`${prefix}${relPath}: shebang: ${firstLine} -> ${nextShebang}`);

  if (dryRun) {
    console.log(`[dry-run] would write: ${relPath}`);
    continue;
  }

  await fs.writeFile(binFilePath, `${nextShebang}${rest}`, 'utf8');
  console.log(`wrote: ${relPath}`);
}

console.log('');
console.log(`bin files: ${binFilePaths.length}`);
console.log(`changed files: ${changedFiles}`);
console.log(`skipped files: ${skippedFiles}`);

if (dryRun) {
  console.log('');
  console.log('[dry-run] No files were written.');
}
