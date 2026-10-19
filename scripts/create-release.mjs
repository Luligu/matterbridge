/**
 * create-release.mjs
 * Version: 2.0.0
 *
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
 *   - target = main (always points the release tag to the main branch)
 * - Print tag/title/description and pause for user confirmation before creating
 *
 * Usage:
 *   node scripts/create-release.mjs --version, -v  Show the script version
 *   node scripts/create-release.mjs --help, -h     Show the help
 *   node scripts/create-release.mjs [--dry-run|-n]
 *
 * The script runs only when executed directly. Importing it exposes `main` without side effects.
 */

/* oxlint-disable no-console */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const scriptVersion = '2.0.0';

/**
 * Builds the help text.
 *
 * @returns {string} The usage message.
 */
function usage() {
  return [
    'Usage: node scripts/create-release.mjs [--dry-run|-n]',
    '',
    'Create a GitHub release from the package.json version and the CHANGELOG.md entry.',
    '',
    '  --dry-run, -n  Print the tag, title and description without asking or creating the release',
    '  --version, -v  Show the script version',
    '  --help, -h     Show this help message',
  ].join('\n');
}

/**
 * Strip leading.
 *
 * @param {unknown} version version value.
 * @returns {string} The result.
 */
function stripLeadingV(version) {
  return typeof version === 'string' ? version.replace(/^v/i, '') : '';
}

/**
 * Is semver bracket line.
 *
 * @param {string} line line value.
 * @returns {boolean} The result.
 */
function isSemverBracketLine(line) {
  // Matches typical changelog headings like:
  //   ## [2.0.8] - 2026-02-07
  // and also any line containing [2.0.8]
  return /\[v?\d+\.\d+\.\d+\]/.test(line);
}

/**
 * Normalize newlines.
 *
 * @param {string} text text value.
 * @returns {string} The result.
 */
function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n');
}

/**
 * Extract changelog section.
 *
 * @param {string} changelogText changelogText value.
 * @param {string} version version value.
 * @returns {string} The result.
 */
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

/**
 * Read json.
 *
 * @param {string} filePath filePath value.
 * @returns {Promise<{version?: string}>} The result.
 */
async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Print exactly what will be used to create the release.
 *
 * @param {{tag: string, title: string, description: string}} options options value.
 * @returns {void}
 */
function printRelease({ tag, title, description }) {
  console.log('---');
  console.log(`Tag: ${tag}`);
  console.log(`Title: ${title}`);
  console.log('Description:');
  console.log(description || '(empty)');
  console.log('---');
}

/**
 * Prompt to continue.
 *
 * @returns {Promise<void>} The result.
 */
async function promptToContinue() {
  // User can hit Enter to proceed or type anything else to abort.
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

/**
 * Run gh release create.
 *
 * @param {{tag: string, title: string, notesFilePath: string, cwd: string}} options options value.
 * @returns {Promise<void>} The result.
 */
async function runGhReleaseCreate({ tag, title, notesFilePath, cwd }) {
  return new Promise(
    /**
     * @param {(value?: void) => void} resolve Resolve after successful creation.
     * @param {(reason?: unknown) => void} reject Reject on creation failure.
     */ (resolve, reject) => {
      const args = ['release', 'create', tag, '--title', title, '--notes-file', notesFilePath, '--target', 'main'];
      const child = spawn('gh', args, {
        cwd,
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
    },
  );
}

/**
 * Create the release from the package.json version and the CHANGELOG.md entry.
 *
 * @param {string} repoRoot Directory containing the package.json and the CHANGELOG.md.
 * @param {boolean} dryRun When true, print the release without asking or creating it.
 * @returns {Promise<void>} Resolves when the release is created.
 */
async function createRelease(repoRoot, dryRun) {
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

  printRelease({ tag, title, description });
  if (dryRun) {
    console.log('[dry-run] Release not created.');
    return;
  }
  await promptToContinue();

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'matterbridge-test-release-'));
  const notesFilePath = path.join(tmpDir, `release-notes-${versionNoV}.md`);
  try {
    await fs.writeFile(notesFilePath, normalizeNewlines(description) + '\n', 'utf8');
    await runGhReleaseCreate({ tag, title, notesFilePath, cwd: repoRoot });
  } finally {
    // Best-effort cleanup
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Run the release creation.
 *
 * @param {string[]} [args] Command line arguments, without the runtime and script paths.
 * @param {string} [repoRoot] Directory containing the package.json and the CHANGELOG.md.
 * @returns {Promise<number>} The exit code.
 */
export async function main(args = process.argv.slice(2), repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')) {
  if (args.includes('--version') || args.includes('-v')) {
    console.log(scriptVersion);
    return 0;
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return 0;
  }

  try {
    await createRelease(repoRoot, args.includes('--dry-run') || args.includes('-n'));
    return 0;
  } catch (err) {
    console.error(`create-release: ${err instanceof Error ? err.message : String(err)}`);
    console.error('Make sure you are authenticated with GitHub CLI: gh auth status');
    return 1;
  }
}

// `import.meta.main` needs Node.js 22.18 or 24.2; older runtimes fall back to comparing the executed script path.
if (import.meta.main ?? path.resolve(process.argv[1] ?? '') === import.meta.filename) process.exitCode = await main();
