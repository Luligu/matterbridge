import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function usage() {
  return ['Usage: node scripts/version.mjs <dev|edge>', '', 'Updates package.json version to:', '  <baseVersion>-<dev|edge>-<yyyymmdd>-<7digitRandom>'].join('\n');
}

function formatYyyymmdd(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function random7Digits() {
  return String(Math.floor(1_000_000 + Math.random() * 9_000_000));
}

function requirePlainSemver(version) {
  const trimmed = String(version ?? '').trim();
  if (!/^\d+\.\d+\.\d+$/.test(trimmed)) {
    throw new Error(`package.json version must be plain x.y.z (got: ${JSON.stringify(trimmed)})`);
  }
  return trimmed;
}

const tag = process.argv[2]?.toLowerCase();
if (tag !== 'dev' && tag !== 'edge') {
  console.error(usage());
  process.exitCode = 1;
  throw new Error('Missing or invalid parameter (expected dev or edge).');
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
const rand = random7Digits();

const nextVersion = `${baseVersion}-${tag}-${yyyymmdd}-${rand}`;
pkg.version = nextVersion;

await fs.writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(`package.json version: ${currentVersion} -> ${nextVersion}`);
