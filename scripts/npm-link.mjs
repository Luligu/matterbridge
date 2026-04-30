/* eslint-disable n/no-process-exit */
/* eslint-disable no-console */

import { chmodSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import crossSpawn from 'cross-spawn';

const { sync: spawnSync } = crossSpawn;

const rootDirectory = resolve(fileURLToPath(import.meta.url), '..');
const repoRoot = resolve(rootDirectory, '..');
const args = ['link', '--no-fund', '--no-audit'];

console.log('Linking matterbridge globally...');
const first = spawnSync('npm', args, { stdio: 'inherit', cwd: repoRoot });

if (first.status !== 0) {
  console.log('Retrying with sudo...');
  const second = spawnSync('sudo', ['npm', ...args], { stdio: 'inherit', cwd: repoRoot });
  if (second.status !== 0) {
    console.error('Link failed even with sudo.');
    process.exit(second.status ?? 1);
  }
}

console.log('Setting executable permissions for bin files...');
const binDir = resolve(repoRoot, 'bin');
for (const file of readdirSync(binDir).filter((f) => f.endsWith('.js'))) {
  console.log(`Setting permissions for ${file}...`);
  chmodSync(resolve(binDir, file), 0o755);
}

console.log('Done.');
