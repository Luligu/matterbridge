/* eslint-disable n/no-process-exit */
import os from 'node:os';
import path from 'node:path';
import { access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);

const candidateOneDriveRoots = [
  process.env.ONE_DRIVE_ROOT,
  process.env.OneDriveCommercial,
  process.env.OneDriveConsumer,
  process.env.OneDrive,
  process.env.ONEDRIVE,
  process.env.HOMEPATH && process.env.HOMEDRIVE ? path.join(process.env.HOMEDRIVE, process.env.HOMEPATH, 'OneDrive') : undefined,
  process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'OneDrive') : undefined,
  process.env.HOME ? path.join(process.env.HOME, 'OneDrive') : undefined,
].filter(Boolean);

const defaultAutomatorRelative = path.join('Code', 'automator', 'automator.mjs');

const candidateAutomatorPaths = [process.env.AUTOMATOR_PATH, ...candidateOneDriveRoots.map((root) => path.join(root, defaultAutomatorRelative))].filter(Boolean);

const exists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

let automatorPath;
for (const candidate of candidateAutomatorPaths) {
  if (await exists(candidate)) {
    automatorPath = candidate;
    break;
  }
}

if (!automatorPath) {
  const lines = [
    '[automator] Could not locate automator.mjs.',
    '',
    'Tried:',
    ...candidateAutomatorPaths.map((p) => `  - ${p}`),
    '',
    'Fix options:',
    '  - Set env var AUTOMATOR_PATH to the full path of automator.mjs',
    '  - Or set env var ONE_DRIVE_ROOT to your OneDrive root directory',
    '  - Or ensure OneDrive env vars (OneDrive/OneDriveCommercial/OneDriveConsumer) are set',
  ];
  // eslint-disable-next-line no-console
  console.error(lines.join(os.EOL));
  process.exit(1);
}

const result = spawnSync(process.execPath, [automatorPath, ...argv], {
  stdio: 'inherit',
  windowsHide: true,
});

process.exit(result.status ?? 1);
