/**
 * badges.mjs
 * Version: 1.0.0
 *
 * Updates the shields.io endpoint badges (npm.json and docker.json) stored in a GitHub gist with the
 * all-time npm downloads of the package in ../package.json and the Docker Hub pulls, formatted with one decimal (e.g. 1.1M).
 *
 * Usage:
 *   node scripts/badges.mjs --version, -v  Show the script version
 *   node scripts/badges.mjs --help, -h     Show the help
 *   node scripts/badges.mjs [--dry-run|-n]
 *
 * Env:
 *   GIST_ID      Id of the gist holding npm.json and docker.json (optional, default the Matterbridge badges gist)
 *   GIST_TOKEN   Classic personal access token with the `gist` scope (optional, default the GitHub CLI token from `gh auth token`)
 *   DOCKER_REPO  Docker Hub repository "namespace/repo" (optional, default "luligu/matterbridge")
 *
 * Requirements:
 *   Node.js 18+ (for global fetch)
 *
 * The script runs only when executed directly. Importing it exposes `main` without side effects.
 */

/* oxlint-disable no-console */
/* oxlint-disable typescript/no-unsafe-type-assertion */

import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptVersion = '1.0.0';

/** Gist holding the npm.json and docker.json endpoint badges used by the READMEs. */
const defaultGistId = 'b21088ab9c9f2b119b42c33f0fef218d';

/** The npm downloads API answers for at most 18 months per request, so the total is summed over chunks of this many days. */
const chunkDays = 540;

/**
 * @typedef {{ schemaVersion: 1, label: string, message: string, color: string }} EndpointBadge
 */

/**
 * Builds the help text.
 *
 * @returns {string} The usage message.
 */
function usage() {
  return [
    'Usage: node scripts/badges.mjs [--dry-run|-n]',
    '',
    'Update the npm.json and docker.json shields.io endpoint badges in the gist GIST_ID (default the Matterbridge badges gist),',
    'authenticating with GIST_TOKEN or, when not set, the GitHub CLI token.',
    '',
    '  --dry-run, -n  Print the badges without updating the gist',
    '  --version, -v  Show the script version',
    '  --help, -h     Show this help message',
  ].join('\n');
}

/**
 * Sleep for a given amount of time.
 *
 * @param {number} ms - Duration in milliseconds.
 * @returns {Promise<void>} Resolves after `ms`.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a JSON document, retrying with backoff on HTTP 429 (the npm downloads API rate-limits bursts).
 *
 * @param {string} url - Url to fetch.
 * @returns {Promise<unknown>} Parsed JSON.
 */
async function fetchJson(url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { 'accept': 'application/json', 'user-agent': 'matterbridge-badges' } });
    if (res.ok) return await res.json();
    if (res.status !== 429) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} fetching ${url}\n${text.slice(0, 200)}`);
    }
    await sleep(2000 * 2 ** attempt);
  }
  throw new Error(`HTTP 429 fetching ${url}`);
}

/**
 * Format a date as YYYY-MM-DD (UTC).
 *
 * @param {Date} date - Date to format.
 * @returns {string} The day key.
 */
function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Sum the all-time npm downloads of a package, from its creation date to today, in chunks of at most 18 months.
 *
 * @param {string} pkgName - NPM package name.
 * @returns {Promise<number>} Total downloads.
 */
async function fetchTotalDownloads(pkgName) {
  const encoded = encodeURIComponent(pkgName).replace('%40', '@');
  const doc = /** @type {{ time?: { created?: string } }} */ (await fetchJson(`https://registry.npmjs.org/${encoded}`));
  const day = 86_400_000;
  let start = new Date((doc.time?.created ?? '2015-01-10').slice(0, 10));
  const end = new Date(dayKey(new Date()));
  let total = 0;
  while (start <= end) {
    const stop = new Date(Math.min(start.getTime() + (chunkDays - 1) * day, end.getTime()));
    const data = /** @type {{ downloads?: number }} */ (await fetchJson(`https://api.npmjs.org/downloads/point/${dayKey(start)}:${dayKey(stop)}/${encoded}`));
    total += data.downloads ?? 0;
    start = new Date(stop.getTime() + day);
  }
  return total;
}

/**
 * Fetch the total pulls of a Docker Hub repository.
 *
 * @param {string} repo - Repository "namespace/repo".
 * @returns {Promise<number>} Total pulls.
 */
async function fetchDockerPulls(repo) {
  const [namespace, name] = repo.split('/');
  if (!namespace || !name) throw new Error(`Invalid DOCKER_REPO "${repo}". Expected "namespace/repo".`);
  const data = /** @type {{ pull_count?: unknown }} */ (await fetchJson(`https://hub.docker.com/v2/repositories/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/`));
  if (typeof data.pull_count !== 'number') throw new Error('Unexpected Docker Hub response: missing numeric pull_count');
  return data.pull_count;
}

/**
 * Format a count with a metric suffix and always one decimal (e.g. 950, 1.0k, 693.6k, 1.1M, 12.2M).
 *
 * @param {number} n - Count to format.
 * @returns {string} The formatted count.
 */
export function formatCount(n) {
  const units = ['', 'k', 'M', 'B'];
  let value = n;
  let unit = 0;
  // Round before choosing the unit so 999,960 becomes 1.0M instead of 1000.0k.
  while (unit < units.length - 1 && Math.round(value * 10) / 10 >= 1000) {
    value /= 1000;
    unit++;
  }
  return unit === 0 ? String(n) : `${value.toFixed(1)}${units[unit]}`;
}

/**
 * Build a shields.io endpoint badge.
 *
 * @param {string} label - Badge label.
 * @param {number} count - Badge count.
 * @returns {EndpointBadge} The badge JSON.
 */
function badge(label, count) {
  return { schemaVersion: 1, label, message: formatCount(count), color: 'blue' };
}

/**
 * Overwrite files of a gist.
 *
 * @param {string} gistId - Gist id.
 * @param {string} token - Token with the `gist` scope.
 * @param {Record<string, EndpointBadge>} files - Files to write, by filename.
 * @returns {Promise<void>}
 */
async function updateGist(gistId, token, files) {
  const body = { files: Object.fromEntries(Object.entries(files).map(([filename, json]) => [filename, { content: JSON.stringify(json) + '\n' }])) };
  const res = await fetch(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, {
    method: 'PATCH',
    headers: {
      'accept': 'application/vnd.github+json',
      'authorization': `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'matterbridge-badges',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} updating gist ${gistId}\n${text.slice(0, 200)}`);
  }
}

/**
 * Get the token of the GitHub CLI, used when GIST_TOKEN is not set (e.g. when run locally).
 *
 * @returns {string | undefined} The token, or undefined when gh is not installed or not logged in.
 */
function ghAuthToken() {
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Compute the badges and update the gist.
 *
 * @param {string} pkgPath - Path of the package.json.
 * @param {boolean} dryRun - When true, print the badges without updating the gist.
 * @returns {Promise<void>}
 */
async function updateBadges(pkgPath, dryRun) {
  const pkg = /** @type {{ name?: unknown }} */ (JSON.parse(await readFile(pkgPath, 'utf8')));
  if (typeof pkg.name !== 'string' || !pkg.name) throw new Error(`Missing/invalid "name" in ${pkgPath}`);
  const repo = process.env.DOCKER_REPO ?? 'luligu/matterbridge';

  const gistId = process.env.GIST_ID || defaultGistId;
  const token = process.env.GIST_TOKEN || (dryRun ? undefined : ghAuthToken());
  if (!dryRun && !token) throw new Error('Set GIST_TOKEN or log in with the GitHub CLI (gh auth login), or use --dry-run');

  const [downloads, pulls] = await Promise.all([fetchTotalDownloads(pkg.name), fetchDockerPulls(repo)]);
  const files = { 'npm.json': badge('downloads', downloads), 'docker.json': badge('docker pulls', pulls) };

  console.log(`npm ${pkg.name}: ${downloads} downloads -> ${files['npm.json'].message}`);
  console.log(`docker ${repo}: ${pulls} pulls -> ${files['docker.json'].message}`);

  if (dryRun || !token) {
    console.log('[dry-run] Gist not updated');
    return;
  }
  await updateGist(gistId, token, files);
  console.log(`Gist ${gistId} updated`);
}

/**
 * Entrypoint.
 *
 * @param {string[]} [args] - Command line arguments, without the runtime and script paths.
 * @param {string} [pkgPath] - Path of the package.json.
 * @returns {Promise<number>} The exit code.
 */
export async function main(args = process.argv.slice(2), pkgPath = fileURLToPath(new URL('../package.json', import.meta.url))) {
  if (args.includes('--version') || args.includes('-v')) {
    console.log(scriptVersion);
    return 0;
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return 0;
  }

  try {
    await updateBadges(pkgPath, args.includes('--dry-run') || args.includes('-n'));
    return 0;
  } catch (err) {
    console.error(err instanceof Error ? err.stack : String(err));
    return 1;
  }
}

// `import.meta.main` needs Node.js 22.18 or 24.2; older runtimes fall back to comparing the executed script path.
if (import.meta.main ?? path.resolve(process.argv[1] ?? '') === import.meta.filename) process.exitCode = await main();
