/**
 * This file contains the Inspector class.
 *
 * @file inspector.ts
 * @author Luca Liguori
 * @created 2025-10-12
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

/* eslint-disable no-console */

if (process.argv.includes('--loader') || process.argv.includes('-loader')) console.log('\u001B[32mInspector loaded.\u001B[40;0m');

import EventEmitter from 'node:events';
import type { InspectorNotification, HeapProfiler, Session } from 'node:inspector';

import { AnsiLogger, LogLevel, TimestampFormat, BRIGHT, CYAN, RESET, YELLOW, db } from 'node-ansi-logger';

// Inspector events
interface InspectorEvents {
  /** Start the inspector */
  start: [];
  /** Stop the inspector */
  stop: [];
  /** Take a heap snapshot */
  snapshot: [];
  /** Heap snapshot done */
  snapshot_done: [];
  /** Run garbage collector */
  gc: [type?: 'major' | 'minor', execution?: 'sync' | 'async'];
  /** Garbage collection done */
  gc_done: [type: 'major' | 'minor', execution: 'sync' | 'async'];
}

export class Inspector extends EventEmitter<InspectorEvents> {
  private session: Session | undefined;
  private snapshotInterval?: NodeJS.Timeout;

  private snapshotInProgress = false;
  private log: AnsiLogger;

  constructor(
    private readonly name: string = 'Inspector',
    private readonly debug: boolean = false,
    private readonly verbose: boolean = false,
  ) {
    super();
    if (process.argv.includes('--debug') || process.argv.includes('-debug')) {
      this.debug = true;
    }
    if (process.argv.includes('--verbose') || process.argv.includes('-verbose')) {
      this.verbose = true;
    }
    this.log = new AnsiLogger({ logName: this.name, logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: this.debug ? LogLevel.DEBUG : LogLevel.INFO });
    this.log.logNameColor = YELLOW;

    this.on('start', () => {
      this.start();
    });

    this.on('stop', () => {
      this.stop();
    });

    this.on('snapshot', () => {
      this.takeHeapSnapshot();
    });

    this.on('gc', () => {
      this.runGarbageCollector();
    });
  }

  /**
   * Starts the inspector for heap sampling.
   *
   * This function is called when the -inspect parameter is passed to matterbridge.
   *
   * The -snapshotinterval parameter can be used to set the heap snapshot interval. Default is undefined. Minimum is 30000 ms.
   * The snapshot is saved in the heap_profiles directory that is created in the current working directory.
   * The snapshot can be analyzed using vscode or Chrome DevTools or other tools that support heap snapshots.
   */
  async start() {
    if (this.session) {
      this.log.warn('Inspector session already active.');
      return;
    }
    const { Session } = await import('node:inspector');
    const { mkdirSync } = await import('node:fs');

    this.log.debug(`Starting heap sampling...`);

    // Create the heap profiles directory if it doesn't exist
    mkdirSync('heap_profiles', { recursive: true });

    // Create the heap snapshots directory if it doesn't exist
    mkdirSync('heap_snapshots', { recursive: true });

    try {
      this.session = new Session();
      this.session.connect();
      await new Promise<void>((resolve, reject) => {
        this.session?.post('HeapProfiler.startSampling', (err) => (err ? reject(err) : resolve()));
      });
      this.log.debug(`Started heap sampling`);

      // Set an interval to take heap snapshots
      const { getIntParameter } = await import('./commandLine.js');
      const interval = getIntParameter('snapshotinterval');
      if (interval && interval >= 30000) {
        this.log.debug(`Started heap snapshot interval of ${CYAN}${interval}${db} ms`);
        clearInterval(this.snapshotInterval);
        this.snapshotInterval = setInterval(async () => {
          try {
            if (this.snapshotInProgress) {
              if (this.debug) this.log.debug(`Skip heap snapshot: previous snapshot still in progress`);
              return;
            }
            this.log.debug(`Run heap snapshot interval`);
            await this.takeHeapSnapshot();
          } catch (err) {
            this.log.error(`Error during scheduled heap snapshot: ${err instanceof Error ? err.message : err}`);
          }
        }, interval).unref();
      }
    } catch (err) {
      this.log.error(`Failed to start heap sampling: ${err instanceof Error ? err.message : err}`);
      this.session?.disconnect();
      this.session = undefined;
      return;
    }
  }

  /**
   * Stops the heap sampling and saves the profile to a file in the heap_profiles directory.
   * This function is called when the inspector is stopped.
   */
  async stop() {
    if (!this.session) {
      this.log.warn('No active inspector session.');
      return;
    }

    const { writeFileSync } = await import('node:fs');
    const path = await import('node:path');

    this.log.debug(`Stopping heap sampling...`);

    if (this.snapshotInterval) {
      this.log.debug(`Clearing heap snapshot interval...`);
      // Clear the snapshot interval if it exists
      clearInterval(this.snapshotInterval);
      // Take a final heap snapshot before stopping
      await this.takeHeapSnapshot();
    }

    try {
      const result = await new Promise<HeapProfiler.StopSamplingReturnType>((resolve, reject) => {
        this.session?.post('HeapProfiler.stopSampling', (err, result) => (err ? reject(err) : resolve(result)));
      });

      const profile = JSON.stringify(result.profile);
      const safeTimestamp = new Date().toISOString().replace(/[<>:"/\\|?*]/g, '-');
      const filename = path.join('heap_profiles', `${safeTimestamp}.heapprofile`);
      writeFileSync(filename, profile);

      this.log.debug(`Heap sampling profile saved to ${CYAN}${filename}${db}`);
    } catch (err) {
      this.log.error(`Failed to stop heap sampling: ${err instanceof Error ? err.message : err}`);
    } finally {
      this.session.disconnect();
      this.session = undefined;
      this.log.debug(`Stopped heap sampling`);
    }
  }

  /**
   * Takes a heap snapshot and saves it to the file name 'heap_snapshots/<timestamp>.heapsnapshot'.
   * If triggers a full garbage collection before and after taking the snapshot to reduce noise.
   *
   * This function is called periodically based on the -snapshotinterval parameter.
   * The -snapshotinterval parameter must at least 30000 ms.
   * The snapshot is saved in the heap_snapshots directory that is created in the current working directory.
   * The snapshot can be analyzed using vscode or Chrome DevTools or other tools that support heap snapshots.
   */
  async takeHeapSnapshot() {
    if (!this.session) {
      this.log.warn('No active inspector session.');
      return;
    }

    if (this.snapshotInProgress) {
      if (this.debug) this.log.debug('Heap snapshot already in progress, skipping.');
      return;
    }
    this.snapshotInProgress = true;

    const { createWriteStream } = await import('node:fs');
    const path = await import('node:path');
    const safeTimestamp = new Date().toISOString().replace(/[<>:"/\\|?*]/g, '-');
    const filename = path.join('heap_snapshots', `${safeTimestamp}.heapsnapshot`);

    // Trigger a garbage collection before taking the snapshot to reduce noise
    this.runGarbageCollector('minor', 'async');
    this.runGarbageCollector('major', 'async');

    if (this.debug) this.log.debug(`Taking heap snapshot to ${CYAN}${filename}${db}...`);

    const stream = createWriteStream(filename, { flags: 'w' });
    let streamErrored = false;
    const onStreamError = (err: unknown) => {
      streamErrored = true;
      this.log.error(`Heap snapshot stream error: ${err instanceof Error ? err.message : err}`);
    };
    stream.once('error', onStreamError);

    const chunksListener = (notification: InspectorNotification<HeapProfiler.AddHeapSnapshotChunkEventDataType>) => {
      // notification.params.chunk is a string; write directly to the stream
      if (!stream.write(notification.params.chunk)) {
        // If backpressure engages, it's fine; the stream will buffer internally. We don't block the inspector.
      }
    };
    this.session.on('HeapProfiler.addHeapSnapshotChunk', chunksListener);
    try {
      await new Promise<void>((resolve) => {
        this.session?.post('HeapProfiler.takeHeapSnapshot', (err) => {
          // Detach chunk listener and close the stream, then perform post-actions
          this.session?.off('HeapProfiler.addHeapSnapshotChunk', chunksListener);
          const finalize = () => {
            if (!err && !streamErrored) {
              if (this.debug) this.log.debug(`Heap sampling snapshot saved to ${CYAN}${filename}${db}`);
              this.runGarbageCollector('minor', 'async');
              this.runGarbageCollector('major', 'async');
              this.emit('snapshot_done');
            } else if (err) {
              this.log.error(`Failed to take heap snapshot: ${err instanceof Error ? err.message : err}`);
              this.runGarbageCollector('minor', 'async');
              this.runGarbageCollector('major', 'async');
            }
            resolve();
          };
          // End stream and wait for finish or error
          try {
            stream.end(() => finalize());
          } catch (e) {
            this.log.error(`Error finalizing heap snapshot stream: ${e instanceof Error ? e.message : e}`);
            finalize();
          }
        });
      });
    } finally {
      this.snapshotInProgress = false;
    }
  }

  /**
   * Manually trigger garbage collection to free memory (if exposed with --expose-gc)
   *
   * @param {'major' | 'minor'} type - The type of garbage collection to perform ('major' or 'minor'). Default is 'major'.
   * @param {'sync' | 'async'} execution - The execution mode of garbage collection ('sync' or 'async'). Default is 'async'.
   *
   * @remarks
   * - major collection refers to old-generation mark-sweep/mark-compact cycles.
   * - minor collection refers to young-generation collections (scavenges).
   * - sync execution blocks the main thread until GC is complete, which can cause pauses.
   */
  runGarbageCollector(type: 'major' | 'minor' = 'major', execution: 'sync' | 'async' = 'async') {
    if (global.gc && typeof global.gc === 'function') {
      try {
        global.gc({ type, execution });
        if (this.debug) this.log.debug(`${CYAN}${BRIGHT}Garbage collection (${type}-${execution}) triggered at ${new Date(Date.now()).toLocaleString()}.${RESET}${db}`);
        this.emit('gc_done', type, execution);
      } catch {
        global.gc();
        if (this.debug) this.log.debug(`${CYAN}${BRIGHT}Garbage collection (minor-async) triggered at ${new Date(Date.now()).toLocaleString()}.${RESET}${db}`);
        this.emit('gc_done', 'minor', 'async');
      }
    } else {
      if (this.debug) this.log.debug(`${CYAN}${BRIGHT}Garbage collection not exposed. Start Node.js with --expose-gc to enable manual garbage collection.${RESET}${db}`);
    }
  }
}
