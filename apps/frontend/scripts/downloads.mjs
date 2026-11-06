/**
 * downloads.mjs
 * Version: 2.2.0
 *
 * Prints daily npm downloads for the last 30 days and today for the package in ../package.json.
 * It queries an explicit date range because the npm `last-week` / `last-month` periods can return stale data.
 *
 * Usage:
 *   node scripts/downloads.mjs --version, -v  Show the script version
 *   node scripts/downloads.mjs --help, -h     Show the help
 *   node scripts/downloads.mjs [--dry-run|-n]
 *
 * Requirements:
 *   Node.js 18+ (for global fetch)
 *
 * The script runs only when executed directly. Importing it exposes `main` without side effects.
 */

/* oxlint-disable no-console */
/* oxlint-disable typescript/no-unnecessary-type-conversion */
/* oxlint-disable typescript/no-unsafe-type-assertion */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptVersion = '2.2.0';

/** Number of days before today to include in the range. */
const rangeDays = 30;

/** Maximum number of trailing zero days treated as not yet published by npm. */
const maxPendingDays = 2;

/**
 * @typedef {{ day: string, downloads: number }} DownloadRow
 */

/**
 * @typedef {{ start: string, end: string, package: string, downloads: DownloadRow[] }} NpmDownloadsRangeResponse
 */

/**
 * Builds the help text.
 *
 * @returns {string} The usage message.
 */
function usage() {
  return [
    'Usage: node scripts/downloads.mjs [--dry-run|-n]',
    '',
    'Print the daily npm downloads of the last 30 days and today for the package in ../package.json.',
    '',
    '  --dry-run, -n  Print the package name without querying the npm registry',
    '  --version, -v  Show the script version',
    '  --help, -h     Show this help message',
  ].join('\n');
}

/**
 * Read and parse a JSON file.
 *
 * @param {string} path - File path.
 * @returns {Promise<unknown>} Parsed JSON.
 */
async function readJson(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
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
 * Fetch npm daily download stats for an explicit date range.
 *
 * @param {string} pkgName - NPM package name.
 * @param {string} start - First day (YYYY-MM-DD).
 * @param {string} end - Last day (YYYY-MM-DD).
 * @returns {Promise<NpmDownloadsRangeResponse | null>} Range response, or null when npm has no download data for the package.
 */
async function fetchRangeDownloads(pkgName, start, end) {
  const url = `https://api.npmjs.org/downloads/range/${start}:${end}/${encodeURIComponent(pkgName)}`;
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
  });

  // npm answers 404 until it publishes the first daily count of a new package.
  if (res.status === 404) return null;

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} fetching ${url}\n${text}`);
  }

  const data = /** @type {NpmDownloadsRangeResponse} */ (await res.json());
  if (!data || !Array.isArray(data.downloads)) {
    throw new Error(`Unexpected response shape from ${url}`);
  }
  return data;
}

/**
 * Sum the downloads for a set of daily rows.
 *
 * @param {DownloadRow[]} rows - Daily rows.
 * @returns {number} Total downloads.
 */
function sumDownloads(rows) {
  let total = 0;
  for (const r of rows) total += r.downloads || 0;
  return total;
}

/**
 * Pad a string on the left.
 *
 * @param {string} s - Input.
 * @param {number} width - Target width.
 * @returns {string} Left-padded string.
 */
function padLeft(s, width) {
  return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

/**
 * Pad a string on the right.
 *
 * @param {string} s - Input.
 * @param {number} width - Target width.
 * @returns {string} Right-padded string.
 */
function padRight(s, width) {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

/**
 * Format a number with locale separators.
 *
 * @param {number} n - Number to format.
 * @returns {string} Formatted number.
 */
function formatNumber(n) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n || 0);
}

/**
 * Minimal ANSI styling with auto-disable in non-TTY or when NO_COLOR is set.
 */
const colorEnabled = Boolean(process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== 'dumb' && process.env.FORCE_COLOR !== '0');

/**
 * Wrap a string with an ANSI SGR code.
 *
 * @param {string} code - SGR code.
 * @param {string} text - Text to style.
 * @returns {string} Styled text.
 */
function ansi(code, text) {
  return colorEnabled ? `\u001b[${code}m${text}\u001b[0m` : text;
}

/**
 * @param {string} s - Text.
 * @returns {string} Styled text.
 */
function bold(s) {
  return ansi('1', s);
}

/**
 * @param {string} s - Text.
 * @returns {string} Styled text.
 */
function dim(s) {
  return ansi('2', s);
}

/**
 * @param {string} s - Text.
 * @returns {string} Styled text.
 */
function cyan(s) {
  return ansi('36', s);
}

/**
 * @param {string} s - Text.
 * @returns {string} Styled text.
 */
function green(s) {
  return ansi('32', s);
}

/**
 * @param {string} s - Text.
 * @returns {string} Styled text.
 */
function yellow(s) {
  return ansi('33', s);
}

const style = {
  bold,
  dim,
  cyan,
  green,
  yellow,
};

/**
 * Print the downloads of the package.
 *
 * @param {string} pkgPath - Path of the package.json.
 * @param {boolean} dryRun - When true, print the package name without querying the npm registry.
 * @returns {Promise<void>}
 */
async function printDownloads(pkgPath, dryRun) {
  const pkgUnknown = await readJson(pkgPath);
  if (!pkgUnknown || typeof pkgUnknown !== 'object') {
    throw new Error(`Unexpected JSON in ${pkgPath}`);
  }

  /** @type {Record<string, unknown>} */
  const pkg = /** @type {Record<string, unknown>} */ (pkgUnknown);
  const name = pkg.name;
  if (typeof name !== 'string' || !name) {
    throw new Error(`Missing/invalid "name" in ${pkgPath}`);
  }

  if (dryRun) {
    console.log(`[dry-run] Would fetch the npm downloads of ${name}`);
    return;
  }

  const today = new Date();
  const end = dayKey(today);
  const start = dayKey(new Date(today.getTime() - rangeDays * 24 * 60 * 60 * 1000));
  const rangeData = await fetchRangeDownloads(name, start, end);
  if (!rangeData) {
    console.log(`npm has no download data for ${name} yet: new packages appear after npm publishes their first daily count, usually within 1-2 days.`);
    return;
  }

  const rows = rangeData.downloads.map((r) => ({ day: String(r.day), downloads: Number(r.downloads) || 0 }));
  rows.sort((a, b) => a.day.localeCompare(b.day));

  // npm reports 0 for the latest days until it publishes their counts: mark the trailing zero days as pending.
  const pendingDays = new Set();
  for (let i = rows.length - 1; i >= 0 && pendingDays.size < maxPendingDays && rows[i].downloads === 0; i -= 1) {
    pendingDays.add(rows[i].day);
  }

  const summaryRows = rows.filter((r) => !pendingDays.has(r.day));
  const total = sumDownloads(summaryRows);
  const days = summaryRows.length || 1;
  const avg = Math.round(total / days);
  let minRow = summaryRows[0] ?? { day: '-', downloads: 0 };
  let maxRow = minRow;
  for (const r of summaryRows) {
    if (r.downloads < minRow.downloads) minRow = r;
    if (r.downloads > maxRow.downloads) maxRow = r;
  }

  const dayWidth = Math.max(3, ...rows.map((r) => r.day.length));
  const downloadStrings = rows.map((r) => formatNumber(r.downloads));
  const downloadsWidth = Math.max('DOWNLOADS'.length, ...downloadStrings.map((s) => s.length));
  const rangeStart = rows[0]?.day ?? rangeData.start;
  const rangeEnd = rows[rows.length - 1]?.day ?? rangeData.end;

  console.log(style.bold(style.cyan(`npm downloads (last ${rangeDays} days + today)`)));
  console.log(`${style.dim('Package:')} ${rangeData.package}`);
  console.log(`${style.dim('Range:  ')} ${rangeStart} .. ${rangeEnd}`);
  console.log('');

  console.log(`${style.dim(padRight('DAY', dayWidth))} ${style.dim(padLeft('DOWNLOADS', downloadsWidth))}`);
  console.log(style.dim(`${'-'.repeat(dayWidth)} ${'-'.repeat(downloadsWidth)}`));

  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    const downloads = downloadStrings[i];
    const renderedDownloads = pendingDays.has(r.day) ? style.dim(padLeft('pending', downloadsWidth)) : padLeft(downloads, downloadsWidth);
    console.log(`${padRight(r.day, dayWidth)} ${renderedDownloads}`);
  }

  console.log('');
  console.log(style.dim('Summary'));
  if (pendingDays.size > 0) {
    console.log(style.dim(`Pending:  npm has not published the count of ${[...pendingDays].sort().join(', ')} yet`));
  }
  console.log(`${style.dim('Total:   ')} ${style.bold(style.green(formatNumber(total)))}`);
  console.log(`${style.dim('Avg/day: ')} ${style.yellow(formatNumber(avg))}`);
  console.log(`${style.dim('Min:     ')} ${formatNumber(minRow.downloads)} (${minRow.day})`);
  console.log(`${style.dim('Max:     ')} ${formatNumber(maxRow.downloads)} (${maxRow.day})`);
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
    await printDownloads(pkgPath, args.includes('--dry-run') || args.includes('-n'));
    return 0;
  } catch (err) {
    console.error(err instanceof Error ? err.stack : String(err));
    return 1;
  }
}

// `import.meta.main` needs Node.js 22.18 or 24.2; older runtimes fall back to comparing the executed script path.
if (import.meta.main ?? path.resolve(process.argv[1] ?? '') === import.meta.filename) process.exitCode = await main();
