/**
 * prune-releases.mjs
 * Version: 2.0.0
 *
 * Prunes old releases for a given tag prefix.
 *
 * Usage:
 *   node scripts/prune-releases.mjs --version, -v  Show the script version
 *   node scripts/prune-releases.mjs [--help|-h] [--dry-run|-n] <tag-prefix-to-keep>
 *
 * The script runs only when executed directly. Importing it exposes `main` without side effects.
 */

/* oxlint-disable no-console */
/* oxlint-disable typescript/prefer-nullish-coalescing */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';

const scriptVersion = '2.0.0';

/** @typedef {Parameters<typeof formatRelease>[0] & {id?: number}} Release */

const PAGE_SIZE = 100;

class ExitError extends Error {
  /**
   * Create a CLI exit error.
   *
   * @param {string} message Error message.
   * @param {number} [code] Exit status.
   */
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

function usage() {
  return [
    'Usage: node scripts/prune-releases.mjs [--help|-h] [--dry-run|-n] <tag-prefix-to-keep>',
    '',
    'Examples:',
    '  node scripts/prune-releases.mjs 2.',
    '  node scripts/prune-releases.mjs --dry-run 2.',
    '',
    '  --version, -v  Show the script version',
  ].join('\n');
}

function createColors() {
  const enabled = process.stdout.isTTY && !process.env.NO_COLOR;
  /**
   * Create a colorizer for an ANSI SGR open/close pair.
   *
   * @param {number} open Opening SGR code.
   * @param {number} close Closing SGR code.
   * @returns {(value: string) => string} The colorizer, returning the plain value when colors are disabled.
   */
  const color = (open, close) => (value) => (enabled ? `\u001B[${open}m${value}\u001B[${close}m` : value);

  return {
    bold: color(1, 22),
    cyan: color(36, 39),
    dim: color(2, 22),
    green: color(32, 39),
    red: color(31, 39),
    yellow: color(33, 39),
  };
}

const colors = createColors();

function lineWidth() {
  return Math.min(120, Math.max(60, process.stdout.columns || 80));
}

function hr() {
  console.log(colors.dim('-'.repeat(lineWidth())));
}

/**
 * Section.
 *
 * @param {string} title title value.
 * @returns {void} No return value.
 */
function section(title) {
  hr();
  console.log(colors.bold(colors.cyan(title)));
  hr();
}

/**
 * Throw an ExitError.
 *
 * @param {string} message - Error message.
 * @param {number} [code] - Exit code.
 * @returns {never} Never returns.
 */
function fail(message, code = 1) {
  throw new ExitError(message, code);
}

/**
 * Parse args.
 *
 * @param {string[]} argv argv value.
 * @returns {{dryRun: boolean, keepPrefix: string} | undefined} The result.
 */
function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage());
    // oxlint-disable-next-line unicorn/no-useless-undefined
    return undefined;
  }

  const knownFlags = new Set(['--dry-run', '-n']);
  const flags = argv.filter((/** @type {string} */ value) => value.startsWith('-'));
  const unknownFlags = flags.filter((/** @type {string} */ value) => !knownFlags.has(value));
  const dryRun = flags.some((/** @type {string} */ value) => knownFlags.has(value));
  if (unknownFlags.length > 0) {
    fail(`Unknown option(s): ${unknownFlags.join(', ')}\n\n${usage()}`);
  }

  const keepPrefix = argv.find((/** @type {string} */ value) => !value.startsWith('-'));
  if (!keepPrefix) {
    fail(usage());
  }

  return { dryRun, keepPrefix };
}

/**
 * Run capture.
 *
 * @param {string} command command value.
 * @param {string[]} args args value.
 * @param {{allowFailure?: boolean, input?: string, inherit?: boolean}} [options] options value.
 * @returns {{status: number, stdout: string, stderr: string}} The result.
 */
// oxlint-disable-next-line typescript/consistent-return -- ends with fail(), which always throws
function runCapture(command, args, options = {}) {
  const { allowFailure = false } = options;
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const stdout = result.stdout?.trimEnd() ?? '';
  const stderr = result.stderr?.trimEnd() ?? '';
  if (result.status === 0) {
    return { status: 0, stdout, stderr };
  }

  if (allowFailure) {
    return { status: result.status ?? 1, stdout, stderr };
  }

  const details = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n');
  fail(details ? `${command} ${args.join(' ')} failed:\n${details}` : `${command} ${args.join(' ')} failed.`);
}

/**
 * Print key value.
 *
 * @param {string} key key value.
 * @param {unknown} value value value.
 * @param {(value: string) => string} [colorizer] colorizer value.
 * @returns {void} No return value.
 */
function printKeyValue(key, value, colorizer) {
  const renderedValue = colorizer ? colorizer(String(value)) : String(value);
  console.log(`${key.padEnd(14)} ${renderedValue}`);
}

async function confirmPrompt() {
  const reader = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise(
      /** @param {(answer: string) => void} resolve Resolve with the answer. */ (resolve) => {
        reader.question(colors.bold(colors.yellow('Proceed? [y/N] ')), resolve);
      },
    );
    return answer.trim().toLowerCase() === 'y';
  } finally {
    reader.close();
  }
}

/**
 * Normalize a GitHub repository URL into owner/repo form.
 *
 * @param {string | undefined | null} remoteUrl - Remote URL candidate.
 * @returns {string | null} Repository in owner/repo form, or null.
 */
function normalizeRepositoryUrl(remoteUrl) {
  if (typeof remoteUrl !== 'string' || remoteUrl.trim() === '') {
    return null;
  }

  const trimmed = remoteUrl
    .trim()
    .replace(/^git\+/, '')
    .replace(/\.git$/i, '');
  const sshMatch = trimmed.match(/^git@github\.com:(?<owner>[^/]+)\/(?<repo>[^/]+)$/i);
  if (sshMatch?.groups?.owner && sshMatch.groups.repo) {
    return `${sshMatch.groups.owner}/${sshMatch.groups.repo}`;
  }

  try {
    const url = new URL(trimmed);
    if (url.hostname !== 'github.com') {
      return null;
    }

    const segments = url.pathname.replace(/^\/+/, '').split('/').filter(Boolean);
    if (segments.length >= 2) {
      return `${segments[0]}/${segments[1]}`;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Read the repository from git remote.origin.url.
 *
 * @returns {string | null} Repository in owner/repo form, or null.
 */
function getRepositoryFromGit() {
  const result = runCapture('git', ['remote', 'get-url', 'origin'], { allowFailure: true });
  if (result.status !== 0) {
    return null;
  }
  return normalizeRepositoryUrl(result.stdout);
}

/**
 * Read the repository from package.json.
 *
 * @returns {string | null} Repository in owner/repo form, or null.
 */
function getRepositoryFromPackageJson() {
  try {
    const raw = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
    const pkg = JSON.parse(raw);
    const repository = pkg?.repository;
    const repositoryUrl = typeof repository === 'string' ? repository : repository?.url;
    return normalizeRepositoryUrl(repositoryUrl);
  } catch {
    return null;
  }
}

/**
 * Determine the current GitHub repository.
 *
 * @returns {string} Repository in owner/repo form.
 */
function getRepositoryNameWithOwner() {
  const fromGit = getRepositoryFromGit();
  if (fromGit) {
    return fromGit;
  }

  const fromPackageJson = getRepositoryFromPackageJson();
  if (fromPackageJson) {
    return fromPackageJson;
  }

  throw new Error('Could not determine the GitHub repository. Configure git remote.origin.url or package.json repository.url.');
}

/**
 * Call the GitHub API and parse a JSON response.
 *
 * @param {string} pathname - GitHub API path.
 * @returns {unknown} Parsed JSON payload.
 */
function ghApiJson(pathname) {
  const { stdout } = runCapture('gh', ['api', '--method', 'GET', pathname]);
  return JSON.parse(stdout);
}

/**
 * Format a release for console output.
 *
 * @param {{
 *  name?: string | null,
 *  tag_name?: string | null,
 *  draft?: boolean,
 *  prerelease?: boolean,
 *  created_at?: string | null,
 *  published_at?: string | null,
 * }} release - Release.
 * @returns {string} Formatted description.
 */
function formatRelease(release) {
  const name = release.name || 'release';
  const tag = release.tag_name || '';
  const flags = `${release.draft ? ' draft' : ''}${release.prerelease ? ' prerelease' : ''}`;
  return `${tag.padEnd(20)} ${name}${flags}`;
}

/**
 * List releases for a page.
 *
 * @param {string} owner - Repository owner.
 * @param {string} repo - Repository name.
 * @param {number} page - Page number.
 * @returns {unknown} Release page.
 */
function listReleases(owner, repo, page) {
  return ghApiJson(`repos/${owner}/${repo}/releases?per_page=${PAGE_SIZE}&page=${page}`);
}

/**
 * Delete a release by tag via gh CLI.
 *
 * @param {string} repository - Repository in owner/repo form.
 * @param {string} tagName - Release tag.
 * @returns {void}
 */
function deleteRelease(repository, tagName) {
  runCapture('gh', ['release', 'delete', tagName, '--repo', repository, '--yes']);
}

/**
 * Print release table.
 *
 * @param {Release[]} releases releases value.
 * @param {(value: string) => string} colorizer colorizer value.
 * @returns {void} No return value.
 */
function printReleaseTable(releases, colorizer) {
  if (releases.length === 0) {
    console.log(colors.dim('(none)'));
    return;
  }

  const indexWidth = Math.max(1, String(releases.length).length);
  const headerIndex = colors.bold(colors.yellow('#'.padStart(indexWidth)));
  const headerTag = colors.bold(colors.yellow('tag'.padEnd(20)));
  const headerName = colors.bold(colors.yellow('name'));
  console.log(`${headerIndex}  ${headerTag}  ${headerName}`);
  releases.forEach((release, index) => {
    const tagName = release.tag_name || '';
    const name = release.name || '';
    console.log(`${colors.dim(String(index + 1).padStart(indexWidth))}  ${colorizer(tagName.padEnd(20))}  ${name}`);
  });
}

/**
 * Print planned commands.
 *
 * @param {string} repository repository value.
 * @param {Release[]} releases releases value.
 * @returns {void} No return value.
 */
function printPlannedCommands(repository, releases) {
  section('Dry Run');
  console.log(colors.green('No changes will be made.'));
  console.log();
  console.log(colors.bold(colors.yellow('Commands that would run:')));
  for (const release of releases) {
    console.log(colors.dim(`gh release delete ${release.tag_name} --repo ${repository} --yes`));
  }
}

/**
 * Prune the releases.
 *
 * @param {string[]} args Command line arguments.
 * @returns {Promise<number>} The exit code.
 */
async function run(args) {
  const parsedArgs = parseArgs(args);
  if (!parsedArgs) {
    return 0;
  }

  const { dryRun, keepPrefix } = parsedArgs;
  const repository = getRepositoryNameWithOwner();
  // normalizeRepositoryUrl() only returns a non-empty owner/repo pair.
  const [owner, repo] = repository.split('/');

  section('Remove GitHub Releases');
  printKeyValue('Keep prefix:', keepPrefix, colors.green);
  printKeyValue('Repository:', repository, colors.bold);
  printKeyValue('Dry run:', dryRun ? 'yes' : 'no', dryRun ? colors.yellow : colors.green);
  console.log();

  const allReleases = [];
  let page = 1;
  while (true) {
    const data = listReleases(owner, repo, page);
    const releases = Array.isArray(data) ? data : [];
    if (releases.length === 0) {
      break;
    }

    allReleases.push(...releases);
    if (releases.length < PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  if (allReleases.length === 0) {
    console.log(colors.yellow('No releases found.'));
    return 0;
  }

  const releasesWithTags = allReleases.filter((release) => typeof release?.tag_name === 'string' && release.tag_name.trim() !== '');
  const releasesToDelete = releasesWithTags.filter((release) => !release.tag_name.startsWith(keepPrefix));

  section('Summary');
  printKeyValue('Releases:', allReleases.length, colors.bold);
  printKeyValue('With tags:', releasesWithTags.length, colors.bold);
  printKeyValue('Keeping:', releasesWithTags.length - releasesToDelete.length, colors.green);
  printKeyValue('Deleting:', releasesToDelete.length, releasesToDelete.length > 0 ? colors.yellow : colors.green);
  console.log();

  if (releasesToDelete.length === 0) {
    console.log(colors.green(`No releases to delete. All release tags already match prefix '${keepPrefix}'.`));
    console.log();
    section('Releases');
    printReleaseTable(releasesWithTags, colors.green);
    return 0;
  }

  section('Releases To Delete');
  printReleaseTable(releasesToDelete, colors.yellow);
  console.log();

  if (dryRun) {
    printPlannedCommands(repository, releasesToDelete);
    return 0;
  }

  const confirmed = await confirmPrompt();
  if (!confirmed) {
    console.log(colors.red('Aborted.'));
    return 1;
  }

  console.log();
  section('Delete Releases');
  let deleted = 0;
  let failed = 0;
  for (const release of releasesToDelete) {
    try {
      deleteRelease(repository, release.tag_name);
      deleted += 1;
      console.log(colors.green(`Deleted ${formatRelease(release)}`));
    } catch (error) {
      failed += 1;
      console.error(colors.red(`Failed ${formatRelease(release)}: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  console.log();
  section('Result');
  printKeyValue('Deleted:', deleted, deleted > 0 ? colors.green : colors.bold);
  printKeyValue('Failed:', failed, failed > 0 ? colors.red : colors.green);

  return failed > 0 ? 1 : 0;
}

/**
 * Prune the releases and report the failures.
 *
 * @param {string[]} [args] Command line arguments, without the runtime and script paths.
 * @returns {Promise<number>} The exit code.
 */
export async function main(args = process.argv.slice(2)) {
  if (args.includes('--version') || args.includes('-v')) {
    console.log(scriptVersion);
    return 0;
  }

  try {
    return await run(args);
  } catch (error) {
    if (error instanceof ExitError) {
      if (error.message) {
        console.error(colors.red(error.message));
      }
      return error.code;
    }
    console.error(colors.red(error instanceof Error ? error.message : String(error)));
    console.error(colors.red('Make sure GitHub CLI is installed and authenticated: gh auth status'));
    return 1;
  }
}

// `import.meta.main` needs Node.js 22.18 or 24.2; older runtimes fall back to comparing the executed script path.
if (import.meta.main ?? path.resolve(process.argv[1] ?? '') === import.meta.filename) process.exitCode = await main();
