/**
 * @description This file contains the Jest logKeepAlives helper.
 * @file src/jestFlushAsync.ts
 * @author Luca Liguori
 * @created 2026-04-19
 * @version 1.0.1
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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { inspect } from 'node:util';

import { AnsiLogger, rs } from 'node-ansi-logger';

/**
 * Summarize live libuv handles/requests inside a process.
 *
 * @param {AnsiLogger} log - Logger to use for output
 *
 * @returns {number} - The total number of active handles and requests
 */
export function logKeepAlives(log?: AnsiLogger): number {
  const handles = (process as any)._getActiveHandles?.() ?? [];
  const requests = (process as any)._getActiveRequests?.() ?? [];

  // istanbul ignore next
  const fmtHandle = (h: unknown, i: number) => {
    const ctor = (h as { constructor?: { name?: string } })?.constructor?.name ?? 'Unknown';
    // Timer-like?
    const hasRef = typeof (h as any)?.hasRef === 'function' ? (h as any).hasRef() : undefined;
    // MessagePort?
    const isPort = (h as any)?.constructor?.name?.includes('MessagePort');
    // Socket/Server?
    const fd = (h as any)?.fd ?? (h as any)?._handle?.fd;
    return { i, type: ctor, hasRef, isPort, fd };
  };

  // istanbul ignore next
  const fmtReq = (r: unknown, i: number) => {
    const ctor = (r as { constructor?: { name?: string } })?.constructor?.name ?? 'Unknown';
    return { i, type: ctor };
  };

  const summary = {
    handles: handles.map(fmtHandle),
    requests: requests.map(fmtReq),
  };

  // istanbul ignore next if
  if (summary.handles.length === 0 && summary.requests.length === 0) {
    log?.debug('KeepAlive: no active handles or requests.');
  } else {
    log?.debug(`KeepAlive:${rs}\n${inspect(summary, { depth: 5, colors: true })}`);
    if (!log) {
      process.stdout.write(`KeepAlive:\n${inspect(summary, { depth: 5, colors: true })}\n`);
    }
  }
  return summary.handles.length + summary.requests.length;
}
