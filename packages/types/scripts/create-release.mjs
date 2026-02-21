/* eslint-disable jsdoc/require-jsdoc */
/**
 * Create a GitHub release from the current package.json version and CHANGELOG.md entry.
 *
 * Requirements (per repo request):
 * - Read version from package.json
 * - Find corresponding [x.x.x] section in CHANGELOG.md
 * - Copy text until next [x.x.x]
 * - Create release with:
 *   - tag = version (without leading 'v')
 *   - title = "Release x.x.x"
 *   - description = copied changelog text
 * - Print tag/title/description and pause for user confirmation before creating
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function stripLeadingV(version) {
  return typeof version === 'string' ? version.replace(/^v/i, '') : '';
}

function isSemverBracketLine(line) {
  // Matches typical changelog headings like:
  //   ## [2.0.8] - 2026-02-07
  // and also any line containing [2.0.8]
  return /\[v?\d+\.\d+\.\d+\]/.test(line);
}

function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n');
}

function extractChangelogSection(changelogText, version) {
  const v = stripLeadingV(version);
  const lines = normalizeNewlines(changelogText).split('\n');

  const targetA = `[${v}]`;
  const targetB = `[v${v}]`;

  let startHeadingIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.includes(targetA) || line.includes(targetB)) {
      startHeadingIndex = i;
      break;
    }
  }

  if (startHeadingIndex === -1) {
    throw new Error(`Could not find changelog entry for ${targetA} in CHANGELOG.md`);
  }

  let endIndex = lines.length;
  for (let i = startHeadingIndex + 1; i < lines.length; i += 1) {
    if (isSemverBracketLine(lines[i])) {
      endIndex = i;
      break;
    }
  }

  // Include the heading line itself (e.g. "## [2.0.8] - 2026-02-07") in the release notes.
  const sectionLines = lines.slice(startHeadingIndex, endIndex);
  const sectionText = sectionLines.join('\n').replace(/\n+$/, '');
  return sectionText;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function promptToContinue({ tag, title, description }) {
  // Print exactly what will be used, then pause.
  // User can hit Enter to proceed or type anything else to abort.
  // (Keeps it simple and explicit.)
  // eslint-disable-next-line no-console
  console.log('---');
  // eslint-disable-next-line no-console
  console.log(`Tag: ${tag}`);
  // eslint-disable-next-line no-console
  console.log(`Title: ${title}`);
  // eslint-disable-next-line no-console
  console.log('Description:');
  // eslint-disable-next-line no-console
  console.log(description || '(empty)');
  // eslint-disable-next-line no-console
  console.log('---');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question('Press Enter to create the release, or type "no" to abort: ');
    const normalized = (answer ?? '').trim().toLowerCase();
    if (normalized === '' || normalized === 'y' || normalized === 'yes') {
      return;
    }
    throw new Error('Aborted by user.');
  } finally {
    rl.close();
  }
}

function runGhReleaseCreate({ tag, title, notesFilePath }) {
  return new Promise((resolve, reject) => {
    const args = ['release', 'create', tag, '--title', title, '--notes-file', notesFilePath];
    const child = spawn('gh', args, {
      cwd: repoRoot,
      stdio: 'inherit',
      // Do NOT use `shell: true` on Windows: it concatenates args into a single
      // command string and breaks quoting/spacing (e.g. "Release 2.0.8").
      // It also triggers Node's DEP0190 warning.
      shell: false,
    });

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`gh exited with code ${code}`));
    });
  });
}

async function main() {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const changelogPath = path.join(repoRoot, 'CHANGELOG.md');

  const pkg = await readJson(packageJsonPath);
  const version = pkg?.version;
  if (!version || typeof version !== 'string') {
    throw new Error('package.json does not contain a valid "version" string');
  }

  const versionNoV = stripLeadingV(version);
  const tag = versionNoV;
  const title = `Release ${versionNoV}`;

  const changelogText = await fs.readFile(changelogPath, 'utf8');
  const description = extractChangelogSection(changelogText, versionNoV);

  await promptToContinue({ tag, title, description });

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'matterbridge-test-release-'));
  const notesFilePath = path.join(tmpDir, `release-notes-${versionNoV}.md`);
  await fs.writeFile(notesFilePath, normalizeNewlines(description) + '\n', 'utf8');

  try {
    await runGhReleaseCreate({ tag, title, notesFilePath });
  } finally {
    // Best-effort cleanup
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`create-release: ${err?.message ?? err}`);
  // eslint-disable-next-line no-console
  console.error('Make sure you are authenticated with GitHub CLI: gh auth status');
  process.exitCode = 1;
});
