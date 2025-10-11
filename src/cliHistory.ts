/**
 * This file contains the CLI history page generator.
 *
 * @file cliHistory.ts
 * @author Luca Liguori
 * @created 2025-10-09
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// eslint-disable-next-line no-console
if (process.argv.includes('--loader') || process.argv.includes('-loader')) console.log('\u001B[32mCli history loaded.\u001B[40;0m');

import { writeFileSync } from 'node:fs';
import path from 'node:path';

// History for 6h at 1 sample each 10 seconds = 2160 entries
export const historySize: number = 2160;

export let historyIndex: number = 0;

/**
 * Sets the history index.
 *
 * @param {number} index - The new history index.
 */
export function setHistoryIndex(index: number) {
  if (!Number.isFinite(index) || !Number.isSafeInteger(index)) {
    throw new TypeError('historyIndex must be a finite, safe integer.');
  }
  if (index < 0 || index >= historySize) {
    throw new RangeError(`historyIndex must be between 0 and ${historySize - 1}.`);
  }
  historyIndex = index;
}

export type HistoryEntry = {
  timestamp: number;
  cpu: number;
  peakCpu: number;
  processCpu: number;
  peakProcessCpu: number;
  rss: number;
  peakRss: number;
  heapUsed: number;
  peakHeapUsed: number;
  heapTotal: number;
  peakHeapTotal: number;
  external: number;
  peakExternal: number;
  arrayBuffers: number;
  peakArrayBuffers: number;
};

export const history: HistoryEntry[] = Array.from({ length: historySize }, () => ({
  timestamp: 0,
  cpu: 0,
  peakCpu: 0,
  processCpu: 0,
  peakProcessCpu: 0,
  rss: 0,
  peakRss: 0,
  heapUsed: 0,
  peakHeapUsed: 0,
  heapTotal: 0,
  peakHeapTotal: 0,
  external: 0,
  peakExternal: 0,
  arrayBuffers: 0,
  peakArrayBuffers: 0,
}));

export type GenerateHistoryPageOptions = {
  /**
   * Full path (file name included) for the generated HTML file.
   * Defaults to `<current working directory>/history.html`.
   */
  outputPath?: string;
  /**
   * Title shown in the generated page and browser tab.
   * Defaults to `Matterbridge CPU & Memory History`.
   */
  pageTitle?: string;
};

/**
 * Generates a static HTML dashboard displaying CPU and memory history.
 *
 * @param {GenerateHistoryPageOptions} [options] - Optional configuration for output path, page title, and refresh interval.
 *
 * @returns {string | undefined} The absolute path to the generated HTML file, or undefined if no samples exist.
 */
export function generateHistoryPage(options: GenerateHistoryPageOptions = {}): string | undefined {
  const pageTitle = options.pageTitle ?? 'Matterbridge CPU & Memory History';
  const outputPath = path.resolve(options.outputPath ?? path.join(process.cwd(), 'history.html'));

  const bufferLength = history.length;

  if (bufferLength === 0) {
    return undefined;
  }

  const startIndex = ((Math.trunc(historyIndex) % bufferLength) + bufferLength) % bufferLength;

  const normalizedHistory: HistoryEntry[] = [];

  for (let offset = 0; offset < bufferLength; offset += 1) {
    const index = (startIndex + offset) % bufferLength;
    const entry = history[index];
    if (!entry || entry.timestamp === 0) continue;
    normalizedHistory.push(entry);
  }

  if (normalizedHistory.length === 0) {
    return undefined;
  }

  const peakCpu = Math.max(...normalizedHistory.map((entry) => entry.peakCpu ?? entry.cpu));
  const peakProcessCpu = Math.max(...normalizedHistory.map((entry) => entry.peakProcessCpu ?? entry.processCpu));
  const peakRss = Math.max(...normalizedHistory.map((entry) => entry.peakRss ?? entry.rss));
  const peakHeapUsed = Math.max(...normalizedHistory.map((entry) => entry.peakHeapUsed ?? entry.heapUsed));
  const peakHeapTotal = Math.max(...normalizedHistory.map((entry) => entry.peakHeapTotal ?? entry.heapTotal));
  const firstTimestamp = normalizedHistory[0]?.timestamp ?? Date.now();
  const lastTimestamp = normalizedHistory[normalizedHistory.length - 1]?.timestamp ?? Date.now();

  const historySanitised = JSON.stringify(normalizedHistory).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

  const summary = {
    entries: normalizedHistory.length,
    timeRange: `${new Date(firstTimestamp).toLocaleString()} → ${new Date(lastTimestamp).toLocaleString()}`,
    peakCpu,
    peakProcessCpu,
    peakRss,
    peakHeapUsed,
    peakHeapTotal,
  };

  const summarySanitised = JSON.stringify(summary).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(pageTitle)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <style>
      :root {
        color-scheme: dark light;
        --bg: #0f172a;
        --bg-card: rgba(15, 23, 42, 0.72);
        --fg: #e2e8f0;
        --accent: #38bdf8;
        --muted: #94a3b8;
        --border: rgba(148, 163, 184, 0.2);
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      body {
        margin: 0;
        padding: 20px;
        background: linear-gradient(145deg, #020617, #0f172a);
        color: var(--fg);
        min-width: 320px;
        min-height: 100vh;
      }
      h1 {
        margin-top: 0;
        font-size: clamp(1.6rem, 2.2vw, 2.3rem);
        font-weight: 700;
        color: var(--accent);
      }
      .container {
        min-width: 320px;
        max-width: 1240px;
        margin: 0 auto;
        padding: 0;
        display: grid;
        gap: 20px;
      }
      .card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 20px 60px rgba(15, 23, 42, 0.35);
        backdrop-filter: blur(12px);
        margin: 0;
        width: calc(100% - 40px);
        max-width: 1200px;
        position: relative;
        overflow: hidden;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }
      .summary-item {
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 16px;
        background: rgba(30, 41, 59, 0.85);
      }
      .summary-item h2 {
        margin: 0 0 8px;
        font-size: 0.95rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }
      .summary-item p {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
      }
      canvas {
        width: min(100%, 1200px);
        height: 320px;
        display: block;
        margin: 0 auto;
      }
      .chart-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 16px;
        font-size: 0.85rem;
        color: var(--muted);
      }
      .chart-legend span {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .chart-legend span::before {
        content: '';
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: currentColor;
        opacity: 0.85;
        border: 1px solid rgba(255, 255, 255, 0.4);
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.95rem;
      }
      th, td {
        padding: 8px;
        border-bottom: 1px solid var(--border);
        text-align: left;
        white-space: nowrap;
      }
      th {
        text-transform: uppercase;
        font-size: 0.75rem;
        letter-spacing: 0.08em;
        color: var(--muted);
      }
      td {
        font-size: 0.75rem;
      }
      tr:hover {
        background: rgba(148, 163, 184, 0.08);
      }
      .table-wrapper {
        overflow: auto;
        max-height: 400px;
        scrollbar-color: rgba(148, 163, 184, 0.35) var(--bg-card);
        scrollbar-width: thin;
      }
      .table-wrapper::-webkit-scrollbar {
        width: 10px;
      }
      .table-wrapper::-webkit-scrollbar-track {
        background: var(--bg-card);
      }
      .table-wrapper::-webkit-scrollbar-thumb {
        background-color: rgba(148, 163, 184, 0.45);
        border-radius: 999px;
        border: 2px solid var(--bg-card);
      }
      @media (max-width: 720px) {
        body {
          padding: 16px;
        }
        .card {
          padding: 18px;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <header>
        <h1>${escapeHtml(pageTitle)}</h1>
        <p>Generated ${new Date().toLocaleString()}</p>
      </header>

      <section class="card">
        <div class="summary-grid" id="summary"></div>
      </section>

      <section class="card">
        <h2>Host CPU Usage (%)</h2>
        <canvas id="cpuChart"></canvas>
      </section>

      <section class="card">
        <h2>Process CPU Usage (%)</h2>
        <canvas id="processCpuChart"></canvas>
      </section>

      <section class="card">
        <h2>Memory Usage (MB)</h2>
        <canvas id="memoryChart"></canvas>
      </section>

      <section class="card">
        <h2>Samples</h2>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Host CPU %</th>
                <th title="Host CPU Peak">Peak %</th>
                <th>Process CPU %</th>
                <th title="Process CPU Peak">Peak %</th>
                <th>RSS (MB)</th>
                <th title="RSS Peak">Peak MB</th>
                <th>Heap Used (MB)</th>
                <th title="Heap Used Peak">Peak MB</th>
                <th>Heap Total (MB)</th>
                <th title="Heap Total Peak">Peak MB</th>
              </tr>
            </thead>
            <tbody id="historyTable"></tbody>
          </table>
        </div>
      </section>
    </div>

    <script type="module">
      const HISTORY_DATA = ${historySanitised};
      const SUMMARY_DATA = ${summarySanitised};
      let cleanup = () => {};

      const summaryContainer = document.getElementById('summary');
      const summaryEntries = [
        { label: 'Samples', value: SUMMARY_DATA.entries.toLocaleString() },
        { label: 'Time Range', value: SUMMARY_DATA.timeRange },
        { label: 'Host CPU Peak', value: SUMMARY_DATA.peakCpu.toFixed(2) + ' %' },
        { label: 'Process CPU Peak', value: SUMMARY_DATA.peakProcessCpu.toFixed(2) + ' %' },
        { label: 'RSS Peak', value: formatBytes(SUMMARY_DATA.peakRss) },
        { label: 'Heap Used Peak', value: formatBytes(SUMMARY_DATA.peakHeapUsed) },
        { label: 'Heap Total Peak', value: formatBytes(SUMMARY_DATA.peakHeapTotal) }
      ];

      summaryEntries.forEach(function (itemData) {
        const item = document.createElement('div');
        item.className = 'summary-item';
        item.innerHTML = '<h2>' + itemData.label + '</h2><p>' + itemData.value + '</p>';
        summaryContainer.appendChild(item);
      });

      const tableBody = document.getElementById('historyTable');
      HISTORY_DATA.forEach(function (entry) {
        const row = document.createElement('tr');
        const cells = [
          new Date(entry.timestamp).toLocaleString(),
          entry.cpu.toFixed(2),
          entry.peakCpu.toFixed(2),
          (Number.isFinite(entry.processCpu) ? entry.processCpu : 0).toFixed(2),
          (
            Number.isFinite(entry.peakProcessCpu)
              ? entry.peakProcessCpu
              : Number.isFinite(entry.processCpu)
                ? entry.processCpu
                : 0
          ).toFixed(2),
          bytesToMb(entry.rss).toFixed(2),
          bytesToMb(entry.peakRss).toFixed(2),
          bytesToMb(entry.heapUsed).toFixed(2),
          bytesToMb(entry.peakHeapUsed).toFixed(2),
          bytesToMb(entry.heapTotal).toFixed(2),
          bytesToMb(entry.peakHeapTotal).toFixed(2)
        ];
        row.innerHTML = '<td>' + cells.join('</td><td>') + '</td>';
        tableBody.appendChild(row);
      });

      const labels = HISTORY_DATA.map(function (entry) {
        return formatTimestamp(entry.timestamp);
      });

      const cpuPeakValue = HISTORY_DATA.reduce(function (acc, entry) {
        return Math.max(acc, Number.isFinite(entry.peakCpu) ? entry.peakCpu : 0, Number.isFinite(entry.cpu) ? entry.cpu : 0);
      }, 0);
      const cpuPadding = cpuPeakValue <= 10 ? 2 : cpuPeakValue * 0.1;

      const processCpuPeakValue = HISTORY_DATA.reduce(function (acc, entry) {
        return Math.max(
          acc,
          Number.isFinite(entry.peakProcessCpu) ? entry.peakProcessCpu : 0,
          Number.isFinite(entry.processCpu) ? entry.processCpu : 0
        );
      }, 0);
      const processCpuPadding = processCpuPeakValue <= 10 ? 2 : processCpuPeakValue * 0.1;

        renderCharts();

        function renderCharts() {
        cleanup();

        function draw() {
          renderLineChart('cpuChart', {
            labels: labels,
            datasets: [
              {
                label: 'Host CPU %',
                values: HISTORY_DATA.map(function (entry) {
                  return Number.isFinite(entry.cpu) ? Number(entry.cpu.toFixed(2)) : 0;
                }),
                color: '#38bdf8',
                fill: 'rgba(56, 189, 248, 0.18)'
              },
              {
                label: 'Host Peak CPU %',
                values: HISTORY_DATA.map(function (entry) {
                  return Number.isFinite(entry.peakCpu) ? Number(entry.peakCpu.toFixed(2)) : 0;
                }),
                color: '#facc15',
                dashed: [6, 4]
              }
            ],
            minY: 0,
            maxY: cpuPeakValue + cpuPadding,
            yFormatter: function (value) {
              return value.toFixed(0) + ' %';
            }
          });

          renderLineChart('processCpuChart', {
            labels: labels,
            datasets: [
              {
                label: 'Process CPU %',
                values: HISTORY_DATA.map(function (entry) {
                  return Number.isFinite(entry.processCpu) ? Number(entry.processCpu.toFixed(2)) : 0;
                }),
                color: '#a855f7',
                fill: 'rgba(168, 85, 247, 0.18)'
              },
              {
                label: 'Process Peak CPU %',
                values: HISTORY_DATA.map(function (entry) {
                  if (Number.isFinite(entry.peakProcessCpu)) {
                    return Number(entry.peakProcessCpu.toFixed(2));
                  }
                  if (Number.isFinite(entry.processCpu)) {
                    return Number(entry.processCpu.toFixed(2));
                  }
                  return 0;
                }),
                color: '#f97316',
                dashed: [6, 4]
              }
            ],
            minY: 0,
            maxY: processCpuPeakValue + processCpuPadding,
            yFormatter: function (value) {
              return value.toFixed(0) + ' %';
            }
          });

          renderLineChart('memoryChart', {
            labels: labels,
            datasets: [
              {
                label: 'RSS (MB)',
                values: HISTORY_DATA.map(function (entry) { return bytesToMb(entry.rss); }),
                color: '#34d399',
                fill: 'rgba(52, 211, 153, 0.18)'
              },
              {
                label: 'Heap Total (MB)',
                values: HISTORY_DATA.map(function (entry) { return bytesToMb(entry.heapTotal); }),
                color: '#fb923c'
              },
              {
                label: 'Heap Used (MB)',
                values: HISTORY_DATA.map(function (entry) { return bytesToMb(entry.heapUsed); }),
                color: '#f472b6'
              }
            ],
            minY: 0,
            yFormatter: function (value) {
              return value.toFixed(0) + ' MB';
            }
          });
        }

        draw();

        const debouncedRender = debounce(draw, 150);
        window.addEventListener('resize', debouncedRender);

        cleanup = function () {
          window.removeEventListener('resize', debouncedRender);
        };
      }

      function renderLineChart(canvasId, config) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
          return;
        }

        const parent = canvas.parentElement;
        if (parent) {
          const existingLegend = parent.querySelector('.chart-legend');
          if (existingLegend) {
            existingLegend.remove();
          }
        }

        const parentWidth = parent && parent.clientWidth ? parent.clientWidth : canvas.clientWidth || 720;
        const cssHeight = canvas.dataset.height ? Number(canvas.dataset.height) : 320;
        const dpr = window.devicePixelRatio || 1;

        canvas.width = parentWidth * dpr;
        canvas.height = cssHeight * dpr;
        canvas.style.width = '100%';
        canvas.style.height = cssHeight + 'px';

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return;
        }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    const margin = { top: 20, right: 24, bottom: 48, left: 72 };
    const innerWidth = Math.max(10, parentWidth - margin.left - margin.right);
    const innerHeight = Math.max(10, cssHeight - margin.top - margin.bottom);

        ctx.translate(margin.left, margin.top);

        const allValues = [];
        config.datasets.forEach(function (dataset) {
          dataset.values.forEach(function (value) {
            if (Number.isFinite(value)) {
              allValues.push(value);
            }
          });
        });

        let minY = typeof config.minY === 'number' ? config.minY : Math.min.apply(Math, allValues);
        let maxY = typeof config.maxY === 'number' ? config.maxY : Math.max.apply(Math, allValues);

        if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
          minY = 0;
          maxY = 1;
        }

        if (minY === maxY) {
          const padding = Math.abs(minY) * 0.05 || 1;
          minY -= padding;
          maxY += padding;
        }

        const valueRange = maxY - minY;
        const gridLines = config.yTicks || 4;

        ctx.lineWidth = 1;
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#94a3b8';

        for (let i = 0; i <= gridLines; i += 1) {
          const ratio = i / gridLines;
          const y = innerHeight - ratio * innerHeight;
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(innerWidth, y);
          ctx.stroke();

          const value = minY + ratio * valueRange;
          const label = config.yFormatter ? config.yFormatter(value) : value.toFixed(1);
          ctx.fillText(label, -12, y);
        }

        const xCount = config.labels.length;
        const xTicks = config.xTickCount || Math.min(6, xCount);
        const xStep = xCount > 1 ? Math.max(1, Math.floor(xCount / xTicks)) : 1;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        for (let i = 0; i < xCount; i += xStep) {
          const x = xCount === 1 ? innerWidth / 2 : (i / (xCount - 1)) * innerWidth;
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, innerHeight);
          ctx.stroke();

          ctx.save();
          ctx.translate(x, innerHeight + 14);
          ctx.rotate(-Math.PI / 8);
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(config.labels[i], 0, 0);
          ctx.restore();
        }

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, innerHeight);
        ctx.lineTo(innerWidth, innerHeight);
        ctx.stroke();

        config.datasets.forEach(function (dataset) {
          const points = dataset.values.map(function (value, index) {
            const safeValue = Number.isFinite(value) ? value : minY;
            const x = xCount === 1 ? innerWidth / 2 : (index / (xCount - 1)) * innerWidth;
            const ratio = (safeValue - minY) / valueRange;
            const y = innerHeight - ratio * innerHeight;
            return { x: x, y: y };
          });

          if (dataset.fill && points.length > 1) {
            ctx.fillStyle = dataset.fill;
            ctx.beginPath();
            points.forEach(function (point, pointIndex) {
              if (pointIndex === 0) {
                ctx.moveTo(point.x, point.y);
              } else {
                ctx.lineTo(point.x, point.y);
              }
            });
            const last = points[points.length - 1];
            const first = points[0];
            ctx.lineTo(last.x, innerHeight);
            ctx.lineTo(first.x, innerHeight);
            ctx.closePath();
            ctx.fill();
          }

          if (dataset.dashed) {
            ctx.setLineDash(dataset.dashed);
          } else {
            ctx.setLineDash([]);
          }
          ctx.strokeStyle = dataset.color;
          ctx.lineWidth = dataset.width || 2;
          ctx.beginPath();
          points.forEach(function (point, pointIndex) {
            if (pointIndex === 0) {
              ctx.moveTo(point.x, point.y);
            } else {
              ctx.lineTo(point.x, point.y);
            }
          });
          ctx.stroke();
          ctx.setLineDash([]);
        });

        ctx.setTransform(1, 0, 0, 1, 0, 0);

        if (parent) {
          const legend = document.createElement('div');
          legend.className = 'chart-legend';
          config.datasets.forEach(function (dataset) {
            const legendItem = document.createElement('span');
            legendItem.style.color = dataset.color;
            legendItem.textContent = dataset.label;
            legend.appendChild(legendItem);
          });
          parent.appendChild(legend);
        }
      }

      function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }

      function debounce(fn, delay) {
        let timeout;
        return function () {
          const context = this;
          const args = arguments;
          clearTimeout(timeout);
          timeout = setTimeout(function () {
            fn.apply(context, args);
          }, delay);
        };
      }

      function bytesToMb(bytes) {
        return bytes / (1024 * 1024);
      }

      function formatBytes(bytes) {
        if (!Number.isFinite(bytes)) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let value = bytes;
        let unitIndex = 0;
        while (value >= 1024 && unitIndex < units.length - 1) {
          value /= 1024;
          unitIndex += 1;
        }
        return value.toFixed(2) + ' ' + units[unitIndex];
      }
    </script>
  </body>
</html>`;

  writeFileSync(outputPath, html, { encoding: 'utf-8' });

  return outputPath;
}

/**
 * Escapes HTML special characters to prevent breaking embedded markup.
 *
 * @param {string} input - The string to escape.
 * @returns {string} The escaped string safe for HTML contexts.
 */
function escapeHtml(input: string): string {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
