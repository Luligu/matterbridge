/* eslint-disable n/no-process-exit */
/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';

const packages = ['@typescript/native-preview', 'oxlint', 'oxlint-tsgolint', 'oxfmt'];
const installArgs = ['install', '-g', '--no-fund', '--no-audit', ...packages];
const linkArgs = ['link', '--no-fund', '--no-audit', ...packages];

console.log(`Installing experimental tools globally without sudo: ${packages.join(', ')}`);

const installFirst = spawnSync('npm', installArgs, { stdio: 'inherit', shell: true });

if (installFirst.status !== 0) {
  console.log('Retrying to install experimental tools globally with sudo...');
  const installSecond = spawnSync('sudo', ['npm', ...installArgs], { stdio: 'inherit', shell: true });
  if (installSecond.status !== 0) {
    console.error('Installation failed.');
    process.exit(installSecond.status ?? 1);
  }
}

console.log(`Linking experimental tools on local package without sudo: ${packages.join(', ')}`);

const linkFirst = spawnSync('npm', linkArgs, { stdio: 'inherit', shell: true });

if (linkFirst.status !== 0) {
  console.log('Retrying to link experimental tools on local package with sudo...');
  const linkSecond = spawnSync('sudo', ['npm', ...linkArgs], { stdio: 'inherit', shell: true });
  if (linkSecond.status !== 0) {
    console.error('Linking failed.');
    process.exit(linkSecond.status ?? 1);
  }
}

console.log('Installation and linking completed successfully.');
