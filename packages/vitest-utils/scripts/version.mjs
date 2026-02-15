/* eslint-disable no-console */
/* eslint-disable jsdoc/require-jsdoc */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function usage() {
  return [
    'Usage: node scripts/version.mjs <dev|edge|git|local> [--dry-run]',
    '   or: node scripts/version.mjs --dry-run <dev|edge|git|local>',
    '',
    'Updates package.json version to:',
    '  <baseVersion>-<dev|edge|git|local>-<yyyymmdd>-<7charSha>',
    '',
    'Options:',
    '  --dry-run, -n   Print the next version but do not write package.json',
  ].join('\n');
}

function formatYyyymmdd(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function shortSha7FromGit(repoRoot) {
  const out = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const sha = String(out).trim();
  if (!/^[0-9a-f]{7}$/i.test(sha)) {
    throw new Error(`Unexpected git short SHA output: ${JSON.stringify(sha)}`);
  }
  return sha.toLowerCase();
}

function getShortSha7(repoRoot) {
  try {
    return shortSha7FromGit(repoRoot);
  } catch (err) {
    throw new Error(`Unable to determine git short SHA. (${err instanceof Error ? err.message : String(err)})`, { cause: err });
  }
}

function requirePlainSemver(version) {
  const trimmed = String(version ?? '').trim();
  if (!/^\d+\.\d+\.\d+$/.test(trimmed)) {
    throw new Error(`package.json version must be plain x.y.z (got: ${JSON.stringify(trimmed)})`);
  }
  return trimmed;
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
const positional = args.filter((a) => !a.startsWith('-'));
const tag = positional[0]?.toLowerCase();
if (tag !== 'dev' && tag !== 'edge' && tag !== 'git' && tag !== 'local') {
  console.error(usage());
  process.exitCode = 1;
  throw new Error('Missing or invalid parameter (expected dev, edge, git, or local).');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');

const raw = await fs.readFile(packageJsonPath, 'utf8');
const pkg = JSON.parse(raw);

const currentVersion = pkg.version;
const baseVersion = requirePlainSemver(currentVersion);
const yyyymmdd = formatYyyymmdd(new Date());
const sha7 = getShortSha7(repoRoot);

const nextVersion = `${baseVersion}-${tag}-${yyyymmdd}-${sha7}`;
pkg.version = nextVersion;

if (dryRun) {
  console.log(`[dry-run] package.json version: ${currentVersion} -> ${nextVersion}`);
} else {
  await fs.writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  console.log(`package.json version: ${currentVersion} -> ${nextVersion}`);
}
