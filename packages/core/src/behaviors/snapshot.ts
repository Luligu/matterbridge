/**
 * @file src/behaviors/snapshot.ts
 * @description This file contains the ffmpeg-based CaptureSnapshot capture pipeline.
 * @author Luca Liguori
 * @contributor Claude Fable 5
 * @created 2026-07-30
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
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

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AnsiLogger, LogLevel, MAGENTA, TimestampFormat } from 'node-ansi-logger';

import { hasFfmpeg, redactSource, runFfmpeg } from './ffmpeg.js';

/** Default maximum allowed byte length for a captured JPEG, used when {@link SnapshotRequest.maxBytes} is omitted. */
const MAX_BYTES = 64000;
/** ffmpeg `-q:v` quality values to retry at, in increasing compression (decreasing quality) order. */
const QUALITIES = [6, 10, 14, 18, 24, 31] as const;
/** Width, in pixels, used for the last-resort downgraded capture pass. */
const FALLBACK_WIDTH = 640;
/** Seconds of initial frames to discard from a webcam before capturing, so auto-exposure/white-balance has warmed up. */
const WEBCAM_WARMUP_SECONDS = 1;
/** Maximum time, in milliseconds, allowed for a single ffmpeg snapshot attempt. */
const CAPTURE_TIMEOUT_MS = 10_000;
/** Grace period, in milliseconds, before forcibly killing ffmpeg after a capture timeout. */
const TERMINATION_GRACE_MS = 1_000;

/** Module logger for the ffmpeg-based snapshot capture pipeline. */
const log = new AnsiLogger({ logName: 'Snapshot', logLevel: LogLevel.DEBUG, logNameColor: MAGENTA, logTimestampFormat: TimestampFormat.TIME_MILLIS });

/**
 * Request for a {@link captureSnapshot} capture.
 */
export interface SnapshotRequest {
  /** The camera source: an `rtsp://` url, or a local webcam device name/path. */
  src: string;
  /** The requested capture width, in pixels. */
  width: number;
  /** The requested capture height, in pixels. */
  height: number;
  /** The maximum allowed byte length for the captured JPEG. Default: {@link MAX_BYTES}. */
  maxBytes?: number;
}

/**
 * Result of a {@link captureSnapshot} capture.
 */
export interface SnapshotResult {
  /** The JPEG image data, ready to hand directly to the Matter attribute/command. */
  data: Buffer;
  /** The byte length of {@link SnapshotResult.data}. */
  byteLength: number;
  /** The width of the captured image, in pixels. */
  width: number;
  /** The height of the captured image, in pixels, or -1 when derived from the aspect ratio. */
  height: number;
  /** The ffmpeg `-q:v` quality value used for this capture. */
  quality: number;
  /** Whether the capture was downgraded to {@link FALLBACK_WIDTH} to fit within the requested byte budget. */
  downgraded: boolean;
}

/**
 * Captures a single JPEG snapshot from an RTSP or webcam source via ffmpeg, retrying at increasing compression (and,
 * as a last resort, at a downgraded resolution) until the result fits within maxBytes.
 *
 * @param {SnapshotRequest} request - The snapshot capture request.
 * @returns {Promise<SnapshotResult>} The captured snapshot.
 * @throws {Error} If the request is invalid or no captured JPEG can satisfy the requested maximum byte length.
 */
export async function captureSnapshot(request: SnapshotRequest): Promise<SnapshotResult> {
  const { src, width, height, maxBytes = MAX_BYTES } = request;
  if (typeof src !== 'string' || src.trim().length === 0) {
    throw new Error('Snapshot source must not be empty');
  }
  if (!Number.isFinite(width) || !Number.isInteger(width) || width <= 0) {
    throw new Error(`Snapshot width must be a positive integer, got ${width}`);
  }
  if (!Number.isFinite(height) || !Number.isInteger(height) || height <= 0) {
    throw new Error(`Snapshot height must be a positive integer, got ${height}`);
  }
  if (!Number.isFinite(maxBytes) || !Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new Error(`Snapshot maxBytes must be a positive integer, got ${maxBytes}`);
  }
  const redactedSrc = redactSource(src);
  log.debug(`Capturing snapshot from ${redactedSrc} at ${width}x${height}, maxBytes=${maxBytes}`);
  let last: Buffer = Buffer.alloc(0);
  let lastQuality = QUALITIES[QUALITIES.length - 1];

  // Pass 1: requested resolution
  log.debug(`Pass 1: trying ${width}x${height} at qualities [${QUALITIES.join(', ')}]`);
  for (const q of QUALITIES) {
    log.debug(`Pass 1: grabbing ${width}x${height} at quality ${q}`);
    const buf = await grab(src, width, height, q);
    log.debug(`Pass 1: grabbed ${buf.length}B at quality ${q} (maxBytes=${maxBytes})`);
    last = buf;
    lastQuality = q;
    if (buf.length <= maxBytes) {
      log.debug(`Pass 1: accepted ${buf.length}B at ${width}x${height}, quality ${q}`);
      return { data: buf, byteLength: buf.length, width, height, quality: q, downgraded: false };
    }
  }

  // Pass 2: last resort — cap at 640 wide without upscaling, preserving aspect ratio
  const fallbackWidth = Math.min(width, FALLBACK_WIDTH);
  log.debug(`Pass 2: falling back to ${fallbackWidth}px wide at qualities [${QUALITIES.join(', ')}]`);
  for (const q of QUALITIES) {
    log.debug(`Pass 2: grabbing ${fallbackWidth}px wide at quality ${q}`);
    const buf = await grab(src, fallbackWidth, -1, q);
    log.debug(`Pass 2: grabbed ${buf.length}B at quality ${q} (maxBytes=${maxBytes})`);
    last = buf;
    lastQuality = q;
    if (buf.length <= maxBytes) {
      log.warn(`Snapshot downgraded to ${fallbackWidth}px to fit ${maxBytes}B (requested ${width}x${height})`);
      return { data: buf, byteLength: buf.length, width: fallbackWidth, height: -1, quality: q, downgraded: true };
    }
  }

  throw new Error(`Snapshot capture from ${redactedSrc} exceeds ${maxBytes}B at minimum quality/resolution (${last.length}B at quality ${lastQuality})`);
}

/**
 * Builds the ffmpeg input arguments for a snapshot source: RTSP when `src` is an `rtsp://` url, otherwise a local
 * webcam device, using the platform-appropriate ffmpeg input format.
 *
 * Webcam captures discard the first {@link WEBCAM_WARMUP_SECONDS} of frames via `-ss` (which, for a live/non-seekable
 * input, makes ffmpeg decode-and-drop frames until that timestamp rather than seek): grabbing the very first frame
 * off a webcam is a well-known way to get a black/garbage frame while the sensor's auto-exposure is still settling.
 *
 * @param {string} src - The camera source: an `rtsp://` url, or a local webcam device name/path.
 * @param {number} width - The requested capture width, in pixels.
 * @param {number} height - The requested capture height, in pixels, or -1 when derived from the aspect ratio (see below).
 * @returns {string[]} The ffmpeg input arguments.
 * @throws {Error} If `src` is a webcam device and webcam capture isn't supported on this platform.
 */
function buildInputArgs(src: string, width: number, height: number): string[] {
  if (src.startsWith('rtsp://')) {
    return ['-rtsp_transport', 'tcp', '-i', src];
  }
  const warmup = ['-ss', String(WEBCAM_WARMUP_SECONDS)];
  // Without an explicit -video_size, dshow/v4l2/avfoundation open the device at its own default mode (often the
  // widest native one, e.g. 16:9), and the -vf scale=W:H in grab() below would then force-stretch that frame to
  // the requested W:H box, distorting the aspect ratio (a 16:9 frame squashed into a 4:3 640x480 box, for example).
  // Requesting the exact size here makes the device itself open in that native mode when it has one, so the later
  // scale is a no-op. height === -1 (the Pass 2 downgrade fallback) has no fixed target size to request, so it's
  // left out and the device's default mode is used instead, with -vf scale=WIDTH:-1 preserving whatever aspect that is.
  const videoSize = height === -1 ? [] : ['-video_size', `${width}x${height}`];
  switch (process.platform) {
    case 'linux':
      return ['-f', 'v4l2', ...videoSize, '-i', src, ...warmup];
    case 'darwin':
      return ['-f', 'avfoundation', ...videoSize, '-i', src, ...warmup];
    case 'win32':
      return ['-f', 'dshow', ...videoSize, '-i', `video=${src}`, ...warmup];
    default:
      throw new Error(`Webcam capture via ffmpeg is not supported on platform "${process.platform}"`);
  }
}

/**
 * Spawns ffmpeg to grab a single JPEG frame from an RTSP or webcam source at the given resolution and quality.
 *
 * @param {string} src - The camera source: an `rtsp://` url, or a local webcam device name/path.
 * @param {number} width - The requested capture width, in pixels.
 * @param {number} height - The requested capture height, in pixels, or -1 to derive it from the aspect ratio.
 * @param {number} q - The ffmpeg `-q:v` quality value (lower is higher quality, larger output).
 * @returns {Promise<Buffer>} The captured JPEG image data.
 * @throws {Error} If ffmpeg could not be resolved, capture times out, or webcam capture isn't supported on this platform.
 */
async function grab(src: string, width: number, height: number, q: number): Promise<Buffer> {
  if (!hasFfmpeg()) {
    log.warn('Cannot capture snapshot: missing dependency ffmpeg');
    throw new Error('Cannot capture snapshot: missing dependency ffmpeg');
  }

  return new Promise((resolve, reject) => {
    const scaleExpr = height === -1 ? `scale=${width}:-1` : `scale=${width}:${height}`;
    const args = ['-y', ...buildInputArgs(src, width, height), '-frames:v', '1', '-vf', scaleExpr, '-q:v', String(q), '-f', 'mjpeg', 'pipe:1'];

    const proc = runFfmpeg(args);
    const chunks: Buffer[] = [];
    let stderr = '';
    let forceKillTimeout: NodeJS.Timeout | undefined;
    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      forceKillTimeout = setTimeout(() => {
        proc.kill('SIGKILL');
      }, TERMINATION_GRACE_MS);
      reject(new Error(`Snapshot capture from ${redactSource(src)} timed out after ${CAPTURE_TIMEOUT_MS}ms`));
    }, CAPTURE_TIMEOUT_MS);

    proc.stdout?.on('data', (d: Buffer) => chunks.push(d));
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (forceKillTimeout) clearTimeout(forceKillTimeout);
      if (code === 0) {
        const data = Buffer.concat(chunks);
        if (data.length === 0) {
          reject(new Error(`Snapshot capture from ${redactSource(src)} produced no data`));
          return;
        }
        log.debug(`ffmpeg exited 0, captured ${data.length}B`);
        resolve(data);
      } else {
        log.debug(`ffmpeg exited ${code}: ${stderr}`);
        reject(new Error(`ffmpeg exited ${code}: ${stderr}`));
      }
    });
    proc.on('error', (error) => {
      clearTimeout(timeout);
      if (forceKillTimeout) clearTimeout(forceKillTimeout);
      reject(error);
    });
  });
}

// Manual test entrypoint: run with `npm run build && node dist/behaviors/snapshot.js [source]`
/* v8 ignore start -- exercised manually with a real camera and ffmpeg, not by unit tests */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const src = process.argv[2] ?? 'Surface Camera Front';
  const outputDir = path.join(process.cwd(), 'temp');
  await mkdir(outputDir, { recursive: true });

  const resolutions = [
    { width: 640, height: 480 },
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
  ];
  for (const { width, height } of resolutions) {
    const result = await captureSnapshot({ src, width, height });
    const outputFile = path.join(outputDir, `snapshot-${width}x${height}.jpeg`);
    await writeFile(outputFile, result.data);
    log.info(`Saved snapshot to ${outputFile} (${result.byteLength}B, ${result.width}x${result.height}, quality=${result.quality}, downgraded=${result.downgraded})`);
  }
}
/* v8 ignore stop */
