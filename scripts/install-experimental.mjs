/* eslint-disable n/no-process-exit */
/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';

const packages = ['@typescript/native-preview', 'oxlint'];
const args = `install -g --no-fund --no-audit ${packages.join(' ')}`;

console.log(`Installing experimental tools globally: ${packages.join(', ')}`);

const first = spawnSync(`npm ${args}`, { stdio: 'inherit', shell: true });

if (first.status === 0) {
  process.exit(0);
}

if (process.platform === 'win32') {
  console.error('Installation failed. Re-run this command from an Administrator terminal.');
  process.exit(first.status ?? 1);
}

console.log('Retrying with sudo...');
const second = spawnSync('sudo', ['npm', ...args], { stdio: 'inherit' });
process.exit(second.status ?? 1);
