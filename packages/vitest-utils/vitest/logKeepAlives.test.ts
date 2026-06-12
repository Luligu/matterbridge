import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';
import { vi } from 'vitest';

import { logKeepAlives } from '../src/logKeepAlives.js';

describe('logKeepAlives', () => {
  const log = new AnsiLogger({ logName: 'VitestKeepAlives', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should summarize the real active handles and requests when a logger is provided', () => {
    const debugSpy = vi.spyOn(log, 'debug').mockImplementation(() => {});
    expect(logKeepAlives(log)).toBeGreaterThanOrEqual(0);
    expect(debugSpy).toHaveBeenCalledTimes(1);
  });

  test('should log the summary and not write to stdout when a logger is provided', () => {
    const debugSpy = vi.spyOn(log, 'debug').mockImplementation(() => {});
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process as any, '_getActiveHandles').mockReturnValue([{ hasRef: () => true, fd: 7 }]);
    vi.spyOn(process as any, '_getActiveRequests').mockReturnValue([{}]);
    expect(logKeepAlives(log)).toBe(2);
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('KeepAlive:'));
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  test('should write to stdout when no logger is provided', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process as any, '_getActiveHandles').mockReturnValue([{ fd: 1 }]);
    vi.spyOn(process as any, '_getActiveRequests').mockReturnValue([]);
    expect(logKeepAlives()).toBe(1);
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('KeepAlive:'));
  });

  test('should format the different handle and request shapes', () => {
    class MessagePortMock {
      fd = 2;
    }
    const debugSpy = vi.spyOn(log, 'debug').mockImplementation(() => {});
    vi.spyOn(process as any, '_getActiveHandles').mockReturnValue([{ hasRef: () => true, fd: 7 }, new MessagePortMock(), { _handle: { fd: 3 } }, Object.create(null)]);
    vi.spyOn(process as any, '_getActiveRequests').mockReturnValue([{}, Object.create(null)]);
    expect(logKeepAlives(log)).toBe(6);
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('MessagePortMock'));
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown'));
  });

  test('should log the empty message when there are no handles or requests', () => {
    const debugSpy = vi.spyOn(log, 'debug').mockImplementation(() => {});
    vi.spyOn(process as any, '_getActiveHandles').mockReturnValue([]);
    vi.spyOn(process as any, '_getActiveRequests').mockReturnValue([]);
    expect(logKeepAlives(log)).toBe(0);
    expect(debugSpy).toHaveBeenCalledWith('KeepAlive: no active handles or requests.');
  });

  test('should not write to stdout when there are no handles or requests and no logger', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process as any, '_getActiveHandles').mockReturnValue([]);
    vi.spyOn(process as any, '_getActiveRequests').mockReturnValue([]);
    expect(logKeepAlives()).toBe(0);
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  test('should fall back to empty lists when the process internals are not available', () => {
    const proc = process as any;
    const originalHandles = proc._getActiveHandles;
    const originalRequests = proc._getActiveRequests;
    proc._getActiveHandles = undefined;
    proc._getActiveRequests = undefined;
    try {
      const debugSpy = vi.spyOn(log, 'debug').mockImplementation(() => {});
      expect(logKeepAlives(log)).toBe(0);
      expect(debugSpy).toHaveBeenCalledWith('KeepAlive: no active handles or requests.');
    } finally {
      proc._getActiveHandles = originalHandles;
      proc._getActiveRequests = originalRequests;
    }
  });
});
