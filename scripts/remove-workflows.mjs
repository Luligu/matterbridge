/* eslint-disable no-console */

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const PAGE_SIZE = 100;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);

/**
 * Print command usage.
 *
 * @returns {void}
 */
function printHelp() {
  console.log(`Remove GitHub Actions workflow runs older than one week.

Usage:
  node scripts/remove-workflows.mjs [--dry-run]

Options:
  --dry-run  Show which workflow runs would be deleted without deleting them
  --help     Show this help message

Requirements:
  - gh CLI installed and authenticated
  - git remote.origin.url configured, or package.json repository.url set`);
}

/**
 * Parse CLI arguments.
 *
 * @param {string[]} argv - CLI arguments.
 * @returns {{ dryRun: boolean, showHelp: boolean }} Parsed flags.
 */
function parseArgs(argv) {
  let dryRun = false;
  let showHelp = false;

  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      showHelp = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { dryRun, showHelp };
}

/**
 * Execute a command and capture stdout and stderr.
 *
 * @param {string} command - Executable name.
 * @param {string[]} args - Command arguments.
 * @returns {Promise<{ stdout: string, stderr: string }>} Captured output.
 */
function execCapture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const message = stderr.trim() || stdout.trim() || `${command} exited with code ${code}`;
      reject(new Error(message));
    });
  });
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
 * @returns {Promise<string | null>} Repository in owner/repo form, or null.
 */
async function getRepositoryFromGit() {
  try {
    const { stdout } = await execCapture('git', ['remote', 'get-url', 'origin']);
    return normalizeRepositoryUrl(stdout);
  } catch {
    return null;
  }
}

/**
 * Read the repository from package.json.
 *
 * @returns {Promise<string | null>} Repository in owner/repo form, or null.
 */
async function getRepositoryFromPackageJson() {
  try {
    const raw = await readFile(new URL('../package.json', import.meta.url), 'utf8');
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
 * @returns {Promise<string>} Repository in owner/repo form.
 */
async function getRepositoryNameWithOwner() {
  const fromGit = await getRepositoryFromGit();
  if (fromGit) {
    return fromGit;
  }

  const fromPackageJson = await getRepositoryFromPackageJson();
  if (fromPackageJson) {
    return fromPackageJson;
  }

  throw new Error('Could not determine the GitHub repository. Configure git remote.origin.url or package.json repository.url.');
}

/**
 * Call the GitHub API and parse a JSON response.
 *
 * @param {string} pathname - GitHub API path.
 * @returns {Promise<unknown>} Parsed JSON payload.
 */
async function ghApiJson(pathname) {
  const { stdout } = await execCapture('gh', ['api', '--method', 'GET', pathname]);
  return JSON.parse(stdout);
}

/**
 * Call the GitHub API with DELETE.
 *
 * @param {string} pathname - GitHub API path.
 * @returns {Promise<void>}
 */
async function ghApiDelete(pathname) {
  await execCapture('gh', ['api', '--method', 'DELETE', pathname]);
}

/**
 * Format a workflow run for console output.
 *
 * @param {{
 *   id?: number,
 *   name?: string,
 *   display_title?: string,
 *   run_number?: number,
 *   head_branch?: string,
 *   created_at?: string,
 *   status?: string,
 * }} run - Workflow run.
 * @returns {string} Formatted description.
 */
function formatRun(run) {
  const name = run.name || run.display_title || 'workflow';
  const number = run.run_number ? `#${run.run_number}` : `id=${run.id}`;
  const branch = run.head_branch ? ` branch=${run.head_branch}` : '';
  const createdAt = run.created_at || 'unknown-date';
  const status = run.status || 'unknown-status';
  return `${name} ${number}${branch} created=${createdAt} status=${status}`;
}

/**
 * List workflow runs for a page.
 *
 * @param {string} owner - Repository owner.
 * @param {string} repo - Repository name.
 * @param {number} page - Page number.
 * @returns {Promise<unknown>} Workflow run page.
 */
async function listWorkflowRuns(owner, repo, page) {
  return ghApiJson(`repos/${owner}/${repo}/actions/runs?per_page=${PAGE_SIZE}&page=${page}`);
}

/**
 * Delete a workflow run.
 *
 * @param {string} owner - Repository owner.
 * @param {string} repo - Repository name.
 * @param {number} runId - Workflow run id.
 * @returns {Promise<void>}
 */
async function deleteWorkflowRun(owner, repo, runId) {
  await ghApiDelete(`repos/${owner}/${repo}/actions/runs/${runId}`);
}

/**
 * Entrypoint.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const { dryRun, showHelp } = parseArgs(process.argv.slice(2));
  if (showHelp) {
    printHelp();
    return;
  }

  const repository = await getRepositoryNameWithOwner();
  const [owner, repo] = repository.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid repository identifier: ${repository}`);
  }

  const cutoffDate = new Date(Date.now() - ONE_WEEK_MS);
  const cutoffTime = cutoffDate.getTime();

  console.log(`Repository: ${repository}`);
  console.log(`Cutoff: ${cutoffDate.toISOString()}`);
  console.log(`Mode: ${dryRun ? 'dry-run' : 'delete'}`);
  console.log('');

  let page = 1;
  let scanned = 0;
  let matched = 0;
  let deleted = 0;
  let skippedActive = 0;
  let failed = 0;

  while (true) {
    const data = await listWorkflowRuns(owner, repo, page);
    const runs = Array.isArray(data?.workflow_runs) ? data.workflow_runs : [];
    if (runs.length === 0) {
      break;
    }

    for (const run of runs) {
      scanned += 1;

      const createdTime = Date.parse(run.created_at || '');
      if (Number.isNaN(createdTime) || createdTime >= cutoffTime) {
        continue;
      }

      if (ACTIVE_STATUSES.has(run.status)) {
        skippedActive += 1;
        console.log(`[skip] ${formatRun(run)} html_url=${run.html_url || 'n/a'}`);
        continue;
      }

      matched += 1;

      if (dryRun) {
        console.log(`[dry-run] Would delete ${formatRun(run)} html_url=${run.html_url || 'n/a'}`);
        continue;
      }

      try {
        await deleteWorkflowRun(owner, repo, run.id);
        deleted += 1;
        console.log(`[delete] Deleted ${formatRun(run)} html_url=${run.html_url || 'n/a'}`);
      } catch (error) {
        failed += 1;
        console.error(`[error] Failed to delete ${formatRun(run)}: ${error?.message || error}`);
      }
    }

    if (runs.length < PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  console.log('');
  console.log('Summary');
  console.log(`Scanned: ${scanned}`);
  console.log(`Older than one week: ${matched}`);
  console.log(`Skipped active: ${skippedActive}`);
  console.log(`${dryRun ? 'Would delete' : 'Deleted'}: ${dryRun ? matched : deleted}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`remove-workflows: ${error?.message || error}`);
  console.error('Make sure GitHub CLI is installed and authenticated: gh auth status');
  process.exitCode = 1;
});
