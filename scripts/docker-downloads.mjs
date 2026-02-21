/**
 * docker-downloads.mjs
 *
 * Tracks Docker Hub pulls per day by sampling the repository "pull_count" daily.
 * Docker Hub provides total pulls for a repo; daily pulls are computed from deltas
 * between daily snapshots.
 *
 * Usage:
 *   node docker-downloads.mjs
 *   node docker-downloads.mjs --days 14
 *   node docker-downloads.mjs --repo luligu/matterbridge --days 30
 *   node docker-downloads.mjs --history ./downloads-history.json
 *
 * Env:
 *   DOCKER_REPO="namespace/repo" (optional, default "luligu/matterbridge")
 */

/* eslint-disable no-console */

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

/**
 * Parse command line args.
 *
 * @param {string[]} argv Process argv array (typically `process.argv`).
 * @returns {{ repo: string, days: number, historyPath: string, noWrite: boolean }} Parsed options.
 */
function parseArgs(argv) {
  const out = {
    repo: process.env.DOCKER_REPO ?? 'luligu/matterbridge',
    days: 14,
    historyPath: './docker-downloads-history.json',
    noWrite: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo') out.repo = argv[++i] ?? out.repo;
    else if (a === '--days') out.days = Number(argv[++i] ?? out.days);
    else if (a === '--history') out.historyPath = argv[++i] ?? out.historyPath;
    else if (a === '--no-write') out.noWrite = true;
    else if (a === '-h' || a === '--help') {
      console.log(`Usage:
  node docker-downloads.mjs [--repo namespace/repo] [--days N] [--history path] [--no-write]

Defaults:
  --repo    luligu/matterbridge
  --days    14
  --history ./docker-downloads-history.json
`);
      // eslint-disable-next-line n/no-process-exit
      process.exit(0);
    }
  }

  if (!Number.isFinite(out.days) || out.days < 1) out.days = 14;
  return out;
}

/**
 * Sleep for a given amount of time.
 *
 * @param {number} ms Duration in milliseconds.
 * @returns {Promise<void>} Resolves after `ms`.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {string} repo "namespace/name"
 * @returns {Promise<{pull_count:number, last_updated?:string}>} Repository stats including total pull_count and optional last_updated timestamp.
 * @throws {Error} If the repo is invalid or the API request fails.
 */
async function fetchRepoStats(repo) {
  const [namespace, name] = repo.split('/');
  if (!namespace || !name) {
    throw new Error(`Invalid --repo "${repo}". Expected "namespace/repo".`);
  }

  const url = `https://hub.docker.com/v2/repositories/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/`;

  // A tiny retry helps with transient 429/5xx.
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'accept': 'application/json',
          'user-agent': 'docker-downloads.mjs (pull tracker)',
        },
      });

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after') ?? '2');
        await sleep(Math.min(10, Math.max(1, retryAfter)) * 1000);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ` - ${text.slice(0, 200)}` : ''}`);
      }

      /** @type {{pull_count:number, last_updated?:string}} */
      const json = await res.json();
      if (typeof json.pull_count !== 'number') {
        throw new Error(`Unexpected response: missing numeric pull_count`);
      }
      return { pull_count: json.pull_count, last_updated: json.last_updated };
    } catch (e) {
      lastErr = e;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr ?? new Error('Failed to fetch repo stats');
}

/**
 * Convert an ISO timestamp to a UTC day key.
 *
 * @param {string} iso ISO timestamp.
 * @returns {string} YYYY-MM-DD (UTC)
 */
function dayKeyUTC(iso) {
  const d = new Date(iso);
  // Force UTC date key
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

/**
 * Load the history JSON file (if present).
 *
 * @param {string} historyPath Path to the JSON history file.
 * @returns {Promise<Array<{ts:string, repo:string, pull_count:number}>>} Parsed history rows.
 */
async function loadHistory(historyPath) {
  if (!existsSync(historyPath)) return [];
  const raw = await readFile(historyPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((x) => x && typeof x.ts === 'string' && typeof x.repo === 'string' && typeof x.pull_count === 'number')
    .map((x) => ({ ts: x.ts, repo: x.repo, pull_count: x.pull_count }));
}

/**
 * Save the history JSON file.
 *
 * @param {string} historyPath Path to the JSON history file.
 * @param {Array<{ts:string, repo:string, pull_count:number}>} rows Rows to write.
 * @returns {Promise<void>}
 */
async function saveHistory(historyPath, rows) {
  const json = JSON.stringify(rows, null, 2) + '\n';
  await writeFile(historyPath, json, 'utf8');
}

/**
 * Keep only one snapshot per repo per day (last one of the day).
 *
 * @param {Array<{ts:string, repo:string, pull_count:number}>} rows All history rows.
 * @param {string} repo Repo in the form `namespace/name`.
 * @returns {Array<{day:string, ts:string, pull_count:number}>} One row per day, sorted.
 */
function compressToDaily(rows, repo) {
  /** @type {Map<string, {day:string, ts:string, pull_count:number}>} */
  const byDay = new Map();

  for (const r of rows) {
    if (r.repo !== repo) continue;
    const day = dayKeyUTC(r.ts);
    const prev = byDay.get(day);
    if (!prev || new Date(r.ts).getTime() > new Date(prev.ts).getTime()) {
      byDay.set(day, { day, ts: r.ts, pull_count: r.pull_count });
    }
  }

  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Compute per-day downloads from daily totals.
 *
 * @param {Array<{day:string, ts:string, pull_count:number}>} daily Daily snapshots (one per day).
 * @param {number} days Number of days to include.
 * @returns {Array<{day:string, total:number|null, downloads:number|null}>} Report rows.
 */
function computeDailyDownloads(daily, days) {
  // Take last N+1 days of totals so we can compute N deltas
  const tail = daily.slice(Math.max(0, daily.length - (days + 1)));

  /** @type {Array<{day:string, total:number|null, downloads:number|null}>} */
  const out = [];
  for (let i = 0; i < tail.length; i++) {
    const cur = tail[i];
    const prev = tail[i - 1];
    const downloads = prev ? Math.max(0, cur.pull_count - prev.pull_count) : null;
    out.push({ day: cur.day, total: cur.pull_count, downloads });
  }

  // We want the last `days` rows with downloads (drop the first which has null downloads)
  return out.slice(Math.max(0, out.length - days));
}

/**
 * Format the report as a plain text table.
 *
 * @param {Array<{day:string, total:number|null, downloads:number|null}>} rows Report rows.
 * @returns {string} Rendered table.
 */
function formatTable(rows) {
  const header = ['Day (UTC)', 'Downloads', 'Total pulls'];
  const lines = [header];

  for (const r of rows) {
    lines.push([r.day, r.downloads == null ? '—' : String(r.downloads), r.total == null ? '—' : String(r.total)]);
  }

  const widths = header.map((_, c) => Math.max(...lines.map((row) => row[c].length)));
  const fmt = (row) => row.map((cell, c) => cell.padEnd(widths[c])).join('  ');
  const sep = widths.map((w) => '-'.repeat(w)).join('  ');

  return [fmt(lines[0]), sep, ...lines.slice(1).map(fmt)].join('\n');
}

/**
 * Entrypoint.
 *
 * @returns {Promise<void>} Resolves when complete.
 */
async function main() {
  const { repo, days, historyPath, noWrite } = parseArgs(process.argv);

  const now = new Date().toISOString();
  const stats = await fetchRepoStats(repo);

  const history = await loadHistory(historyPath);

  // Append snapshot if it's new for today OR pull_count changed (safe to append; we compress later).
  history.push({ ts: now, repo, pull_count: stats.pull_count });

  // Optional: trim history to last 4000 entries to avoid unbounded growth
  const trimmed = history.slice(Math.max(0, history.length - 4000));

  if (!noWrite) {
    await saveHistory(historyPath, trimmed);
  }

  const daily = compressToDaily(trimmed, repo);
  const report = computeDailyDownloads(daily, days);

  console.log(`Repo: ${repo}`);
  console.log(`Snapshot: ${now}  (pull_count=${stats.pull_count})`);
  console.log(`History: ${noWrite ? '(not written)' : historyPath}`);
  console.log('');
  console.log(formatTable(report));
}

main().catch((err) => {
  console.error(`Error: ${err?.message ?? String(err)}`);
  process.exitCode = 1;
});
