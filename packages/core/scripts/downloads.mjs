/**
 * downloads.mjs
 *
 * Prints daily npm downloads for the last month for the package in ../package.json.
 *
 * Usage:
 *   node scripts/download.mjs
 *
 * Requirements:
 *   Node.js 18+ (for global fetch)
 */

/* eslint-disable no-console */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {{ day: string, downloads: number }} DownloadRow
 */

/**
 * @typedef {{ start: string, end: string, package: string, downloads: DownloadRow[] }} NpmDownloadsRangeResponse
 */

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
 * Fetch npm daily download stats for the last month.
 *
 * @param {string} pkgName - NPM package name.
 * @returns {Promise<NpmDownloadsRangeResponse>} Range response.
 */
async function fetchLastMonthDownloads(pkgName) {
  const url = `https://api.npmjs.org/downloads/range/last-month/${encodeURIComponent(pkgName)}`;
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} fetching ${url}\n${text}`);
  }

  const data = await res.json();
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
  for (const r of rows) total += Number(r.downloads) || 0;
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
  const str = String(s);
  return str.length >= width ? str : ' '.repeat(width - str.length) + str;
}

/**
 * Pad a string on the right.
 *
 * @param {string} s - Input.
 * @param {number} width - Target width.
 * @returns {string} Right-padded string.
 */
function padRight(s, width) {
  const str = String(s);
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

/**
 * Format a number with locale separators.
 *
 * @param {number} n - Number to format.
 * @returns {string} Formatted number.
 */
function formatNumber(n) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(n) || 0);
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
  if (!colorEnabled) return text;
  return `\u001b[${code}m${text}\u001b[0m`;
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
 * Entrypoint.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
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

  const data = await fetchLastMonthDownloads(name);

  const rows = data.downloads.map((r) => ({ day: String(r.day), downloads: Number(r.downloads) || 0 })).sort((a, b) => a.day.localeCompare(b.day));

  const total = sumDownloads(rows);
  const days = rows.length || 1;
  const avg = Math.round(total / days);
  const minRow = rows.reduce((m, r) => (r.downloads < m.downloads ? r : m), rows[0] ?? { day: '-', downloads: 0 });
  const maxRow = rows.reduce((m, r) => (r.downloads > m.downloads ? r : m), rows[0] ?? { day: '-', downloads: 0 });

  const dayWidth = Math.max(3, ...rows.map((r) => String(r.day).length));
  const downloadStrings = rows.map((r) => formatNumber(r.downloads));
  const downloadsWidth = Math.max('DOWNLOADS'.length, ...downloadStrings.map((s) => s.length));

  console.log(style.bold(style.cyan('npm downloads (last-month)')));
  console.log(`${style.dim('Package:')} ${data.package}`);
  console.log(`${style.dim('Range:  ')} ${data.start} .. ${data.end}`);
  console.log('');

  console.log(`${style.dim(padRight('DAY', dayWidth))} ${style.dim(padLeft('DOWNLOADS', downloadsWidth))}`);
  console.log(style.dim(`${'-'.repeat(dayWidth)} ${'-'.repeat(downloadsWidth)}`));

  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    const downloads = downloadStrings[i];
    console.log(`${padRight(r.day, dayWidth)} ${padLeft(downloads, downloadsWidth)}`);
  }

  console.log('');
  console.log(style.dim('Summary'));
  console.log(`${style.dim('Total:   ')} ${style.bold(style.green(formatNumber(total)))}`);
  console.log(`${style.dim('Avg/day: ')} ${style.yellow(formatNumber(avg))}`);
  console.log(`${style.dim('Min:     ')} ${formatNumber(minRow.downloads)} (${minRow.day})`);
  console.log(`${style.dim('Max:     ')} ${formatNumber(maxRow.downloads)} (${maxRow.day})`);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});
