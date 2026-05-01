/* eslint-disable n/no-process-exit */
/* eslint-disable no-console */

import crossSpawn from 'cross-spawn';

const { sync: spawnSync } = crossSpawn;

const RED = '\x1b[91m';
const RESET = '\x1b[0m';

const error = (msg) => console.error(`${RED}${msg}${RESET}`);

const packages = ['@typescript/native-preview', 'oxlint', 'oxlint-tsgolint', 'oxfmt'];
const installArgs = ['install', '--global', '--no-fund', '--no-audit', ...packages];
const linkArgs = ['link', '--no-fund', '--no-audit', ...packages];

console.log(`Installing experimental tools globally without sudo: ${packages.join(', ')}...`);

const installFirst = spawnSync('npm', installArgs, { stdio: 'inherit' });

if (installFirst.status !== 0) {
  console.log(`Retrying to install experimental tools globally with sudo: ${packages.join(', ')}...`);
  const installSecond = spawnSync('sudo', ['npm', ...installArgs], { stdio: 'inherit' });
  if (installSecond.status !== 0) {
    error('Installation failed.');
    process.exit(installSecond.status ?? 1);
  }
}

console.log(`Linking experimental tools on local package without sudo: ${packages.join(', ')}...`);

const linkFirst = spawnSync('npm', linkArgs, { stdio: 'inherit' });

if (linkFirst.status !== 0) {
  console.log(`Retrying to link experimental tools on local package with sudo: ${packages.join(', ')}...`);
  const linkSecond = spawnSync('sudo', ['npm', ...linkArgs], { stdio: 'inherit' });
  if (linkSecond.status !== 0) {
    error('Linking failed.');
    process.exit(linkSecond.status ?? 1);
  }
}

console.log('Installation and linking completed successfully.');
