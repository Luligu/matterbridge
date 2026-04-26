/* eslint-disable n/no-process-exit */
/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import { chmodSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const repoRoot = resolve(__dirname, '..');
const args = 'link --no-fund --no-audit';

console.log('Linking matterbridge globally...');

const first = spawnSync(`npm ${args}`, { stdio: 'inherit', shell: true, cwd: repoRoot });

if (first.status !== 0) {
  if (process.platform === 'win32') {
    console.error('Link failed. Re-run this command from an Administrator terminal.');
    process.exit(first.status ?? 1);
  }

  console.log('Retrying with sudo...');
  const second = spawnSync('sudo', ['npm', ...args], { stdio: 'inherit', cwd: repoRoot });
  if (second.status !== 0) process.exit(second.status ?? 1);
}

const binDir = resolve(repoRoot, 'bin');
for (const file of readdirSync(binDir).filter((f) => f.endsWith('.js'))) {
  chmodSync(resolve(binDir, file), 0o755);
}

console.log('Done.');
