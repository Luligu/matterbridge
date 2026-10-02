import '@testing-library/jest-dom';

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import SystemInfoTable from '../src/components/SystemInfoTable';
import { UiContext, type UiContextType } from '../src/components/UiContext';
import { WebSocketContext, type WebSocketContextType } from '../src/components/WebSocketProvider';
import { type SystemInformation } from '../src/utils/backendShared';

const settings = vi.hoisted(() => ({ debug: false, enableMobile: true }));
vi.mock('../src/appState', () => settings);
vi.mock('@mui/material/Tooltip', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../src/components/MbfWindow', () => ({
  MbfWindow: ({ children, style }: { children: React.ReactNode; style: React.CSSProperties }) => (
    <section data-testid="window" style={style}>
      {children}
    </section>
  ),
  MbfWindowHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  MbfWindowHeaderText: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  MbfWindowContent: ({ children, style }: { children: React.ReactNode; style: React.CSSProperties }) => (
    <div data-testid="content" style={style}>
      {children}
    </div>
  ),
  MbfWindowIcons: ({ children, close }: { children: React.ReactNode; close: () => void }) => (
    <div data-testid="controls">
      {children}
      <button type="button" onClick={close}>
        Close
      </button>
    </div>
  ),
}));

function createSystemInfo(overrides: Partial<SystemInformation> = {}): SystemInformation {
  return {
    interfaceName: 'eth0',
    macAddress: '00:11:22:33:44:55',
    ipv4Address: '192.168.1.2',
    ipv6Address: '::1',
    nodeVersion: '24.0.0',
    hostname: 'bridge',
    user: 'tester',
    osType: 'Linux',
    osRelease: '6.8',
    osPlatform: 'linux',
    osArch: 'arm64',
    totalMemory: '8 GB',
    freeMemory: '4 GB',
    systemUptime: '2 days',
    processUptime: '1 hour',
    cpuUsage: '12 %',
    processCpuUsage: '3 %',
    rss: '100 MB',
    heapTotal: '80 MB',
    heapUsed: '40 MB',
    ...overrides,
  };
}

function renderTable({ systemInfo = createSystemInfo(), compact = false, mobile = false }: { systemInfo?: SystemInformation; compact?: boolean; mobile?: boolean } = {}) {
  const addListener = vi.fn();
  const removeListener = vi.fn();
  const sendMessage = vi.fn();
  const getUniqueId = vi.fn().mockReturnValue(42);
  const context = { addListener, removeListener, sendMessage, getUniqueId } as unknown as WebSocketContextType;
  const view = (nextCompact: boolean, nextContext = context) => (
    <UiContext.Provider value={{ mobile } as UiContextType}>
      <WebSocketContext.Provider value={nextContext}>
        <SystemInfoTable systemInfo={systemInfo} compact={nextCompact} />
      </WebSocketContext.Provider>
    </UiContext.Provider>
  );
  const result = render(view(compact));
  const listener = addListener.mock.calls[0][0] as (message: unknown) => void;
  return {
    ...result,
    addListener,
    removeListener,
    sendMessage,
    getUniqueId,
    listener,
    context,
    update: (message: unknown) => act(() => listener(message)),
    rerenderTable: (nextCompact: boolean, nextContext = context) => result.rerender(view(nextCompact, nextContext)),
  };
}

function valueCell(label: string) {
  const row = screen.getByRole('cell', { name: label }).closest('tr');
  if (!row) throw new Error(`Missing row for ${label}`);
  return within(row).getAllByRole('cell')[1];
}

beforeEach(() => {
  settings.debug = false;
  settings.enableMobile = true;
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(window, 'open').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SystemInfoTable rendering', () => {
  test('should render mapped labels, fallback keys, and alternating rows when not compact', () => {
    renderTable();
    const expected = {
      'Interface name': 'eth0',
      'Mac address': '00:11:22:33:44:55',
      'IPv4 address': '192.168.1.2',
      'IPv6 address': '::1',
      'Node version': '24.0.0',
      Hostname: 'bridge',
      User: 'tester',
      Os: 'Linux',
      osRelease: '6.8',
      Platform: 'linux',
      osArch: 'arm64',
      totalMemory: '8 GB',
      Memory: '4 GB',
      'System uptime': '2 days',
      'Process uptime': '1 hour',
      'Host CPU': '12 %',
      'Process CPU': '3 %',
      Rss: '100 MB',
      heapTotal: '80 MB',
      Heap: '40 MB',
    };
    for (const [label, value] of Object.entries(expected)) expect(valueCell(label)).toHaveTextContent(value);
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(Object.keys(expected).length);
    for (const [index, row] of rows.entries()) expect(row).toHaveClass(index % 2 === 0 ? 'table-content-even' : 'table-content-odd');
    expect(screen.getByRole('heading', { name: 'System info' })).toBeInTheDocument();
  });

  test('should combine paired fields without mutating input when compact and restore separate fields when expanded', () => {
    const systemInfo = Object.freeze(createSystemInfo());
    const { rerenderTable } = renderTable({ systemInfo, compact: true });
    expect(valueCell('Memory')).toHaveTextContent('4 GB / 8 GB');
    expect(valueCell('Heap')).toHaveTextContent('40 MB / 80 MB');
    expect(valueCell('Os')).toHaveTextContent('Linux (6.8)');
    expect(valueCell('Platform')).toHaveTextContent('linux (arm64)');
    for (const key of ['totalMemory', 'heapTotal', 'osRelease', 'osArch']) expect(screen.queryByText(key)).not.toBeInTheDocument();
    expect(systemInfo).toEqual(createSystemInfo());
    rerenderTable(false);
    expect(valueCell('Memory')).toHaveTextContent(/^4 GB$/);
    expect(valueCell('totalMemory')).toHaveTextContent('8 GB');
    expect(valueCell('Heap')).toHaveTextContent(/^40 MB$/);
    expect(valueCell('heapTotal')).toHaveTextContent('80 MB');
    expect(valueCell('Os')).toHaveTextContent(/^Linux$/);
    expect(valueCell('osRelease')).toHaveTextContent('6.8');
    expect(valueCell('Platform')).toHaveTextContent(/^linux$/);
    expect(valueCell('osArch')).toHaveTextContent('arm64');
  });

  test.each([
    ['totalMemory', 'Memory', '4 GB'],
    ['freeMemory', 'totalMemory', '8 GB'],
    ['heapTotal', 'Heap', '40 MB'],
    ['heapUsed', 'heapTotal', '80 MB'],
    ['osRelease', 'Os', 'Linux'],
    ['osType', 'osRelease', '6.8'],
    ['osArch', 'Platform', 'linux'],
    ['osPlatform', 'osArch', 'arm64'],
  ])('should preserve the other field when compact and %s is empty', (key, label, value) => {
    renderTable({ systemInfo: createSystemInfo({ [key]: '' }), compact: true });
    expect(valueCell(label)).toHaveTextContent(value);
  });

  test('should replace Node with Bun and omit empty or undefined values when provided', () => {
    const systemInfo = Object.freeze(createSystemInfo({ bunVersion: '1.3.0', user: '', ipv6Address: undefined as unknown as string }));
    renderTable({ systemInfo });
    expect(valueCell('Bun version')).toHaveTextContent('1.3.0');
    for (const label of ['Node version', 'bunVersion', 'User', 'IPv6 address']) expect(screen.queryByText(label)).not.toBeInTheDocument();
    expect(systemInfo.nodeVersion).toBe('24.0.0');
    expect(systemInfo.bunVersion).toBe('1.3.0');
  });

  test.each([
    { mobile: false, enableMobile: true, responsive: false },
    { mobile: true, enableMobile: false, responsive: false },
    { mobile: true, enableMobile: true, responsive: true },
  ])('should use the correct layout when mobile=$mobile and enableMobile=$enableMobile', ({ mobile, enableMobile, responsive }) => {
    settings.enableMobile = enableMobile;
    const hostname = 'abcdefghijklmnopqrstuvwxyz0123456789';
    renderTable({ mobile, systemInfo: createSystemInfo({ hostname }) });
    const cell = valueCell('Hostname');
    expect(cell.textContent).toBe(responsive ? hostname : `${hostname.slice(0, 10)} \u2026 ${hostname.slice(-9)}`);
    expect(cell.querySelectorAll('span')).toHaveLength(responsive ? 0 : 1);
    expect(screen.getByTestId('window')).toHaveStyle(responsive ? { flex: '1 1 300px' } : { width: '302px', minWidth: '302px', flex: '0 1 auto' });
    expect(screen.getByTestId('content').style.overflow).toBe(responsive ? '' : 'auto');
  });

  test('should render nothing when system information is absent at runtime', () => {
    const { container } = renderTable({ systemInfo: null as unknown as SystemInformation });
    expect(container).toBeEmptyDOMElement();
  });

  test('should remain hidden after closing even when updates arrive', () => {
    const { update, container, unmount, removeListener, listener } = renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(container).toBeEmptyDOMElement();
    update({ method: 'uptime_update', response: { systemUptime: '3 days', processUptime: '2 hours' } });
    expect(container).toBeEmptyDOMElement();
    unmount();
    expect(removeListener).toHaveBeenCalledExactlyOnceWith(listener);
  });
});

describe('SystemInfoTable WebSocket messages', () => {
  test.each([false, true])('should apply updates and open history with debug=%s', (debug) => {
    settings.debug = debug;
    const systemInfo = Object.freeze(createSystemInfo());
    const { update, sendMessage, getUniqueId, rerenderTable, addListener, removeListener, listener, unmount } = renderTable({ systemInfo, compact: true });
    expect(addListener).toHaveBeenCalledExactlyOnceWith(listener, 42);
    update({ method: 'memory_update', response: { totalMemory: '16 GB', freeMemory: '12 GB', heapTotal: '200 MB', heapUsed: '90 MB', rss: '300 MB' } });
    expect(valueCell('Memory')).toHaveTextContent('12 GB / 16 GB');
    expect(valueCell('Heap')).toHaveTextContent('90 MB / 200 MB');
    expect(valueCell('Rss')).toHaveTextContent('300 MB');
    update({ method: 'cpu_update', response: { cpuUsage: 12.345, processCpuUsage: 0 } });
    expect(valueCell('Host CPU')).toHaveTextContent('12.35 %');
    expect(valueCell('Process CPU')).toHaveTextContent('0.00 %');
    update({ method: 'cpu_update', response: { cpuUsage: 9, processCpuUsage: 1.234 } });
    expect(valueCell('Host CPU')).toHaveTextContent('9.00 %');
    expect(valueCell('Process CPU')).toHaveTextContent('1.23 %');
    update({ method: 'uptime_update', response: { systemUptime: '3 days', processUptime: '2 hours' } });
    expect(valueCell('System uptime')).toHaveTextContent('3 days');
    expect(valueCell('Process uptime')).toHaveTextContent('2 hours');
    expect(valueCell('Hostname')).toHaveTextContent('bridge');
    expect(systemInfo).toEqual(createSystemInfo());

    getUniqueId.mockReturnValue(99);
    rerenderTable(false);
    expect(valueCell('totalMemory')).toHaveTextContent('16 GB');
    expect(addListener).toHaveBeenCalledTimes(1);
    fireEvent.click(within(screen.getByTestId('controls')).getAllByRole('button')[0]);
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({ id: 42, sender: 'Header', method: '/api/viewhistorypage', src: 'Frontend', dst: 'Matterbridge', params: {} });
    expect(window.open).not.toHaveBeenCalled();
    update({ method: '/api/viewhistorypage', id: 42, success: true });
    expect(window.open).toHaveBeenCalledExactlyOnceWith('./api/viewhistory', '_blank', 'noopener,noreferrer');
    unmount();
    expect(removeListener).toHaveBeenCalledExactlyOnceWith(listener);
    expect(vi.mocked(console.log).mock.calls.some(([message]) => message === 'SystemInfoTable removed WebSocket listener')).toBe(debug);
    expect(vi.mocked(console.log).mock.calls.length > 0).toBe(debug);
  });

  test.each(['totalMemory', 'freeMemory', 'heapTotal', 'heapUsed', 'rss'])('should ignore a memory update when %s is missing', (key) => {
    const { update } = renderTable();
    const response: Record<string, string> = { totalMemory: '16 GB', freeMemory: '12 GB', heapTotal: '200 MB', heapUsed: '90 MB', rss: '300 MB' };
    const { [key]: _missing, ...incompleteResponse } = response;
    update({ method: 'memory_update', response: incompleteResponse });
    expect(valueCell('totalMemory')).toHaveTextContent('8 GB');
    expect(valueCell('Memory')).toHaveTextContent('4 GB');
    expect(valueCell('heapTotal')).toHaveTextContent('80 MB');
    expect(valueCell('Heap')).toHaveTextContent('40 MB');
    expect(valueCell('Rss')).toHaveTextContent('100 MB');
  });

  test.each([
    { method: 'unknown', response: {} },
    { method: 'memory_update' },
    { method: 'cpu_update' },
    { method: 'uptime_update' },
    { method: 'cpu_update', response: {} },
    { method: 'uptime_update', response: { processUptime: '2 hours' } },
    { method: 'uptime_update', response: { systemUptime: '3 days' } },
    { method: '/api/viewhistorypage', id: 99, success: true },
    { method: '/api/viewhistorypage', id: 42, success: false },
    { method: '/api/viewhistorypage', id: 42 },
  ])('should ignore an incomplete or unrelated message: %j', (message) => {
    const { update } = renderTable();
    const before = screen.getByRole('table').textContent;
    update(message);
    expect(screen.getByRole('table').textContent).toBe(before);
    expect(window.open).not.toHaveBeenCalled();
  });

  test('should retain the previous CPU values when the current guard receives zero host usage', () => {
    const { update } = renderTable();
    update({ method: 'cpu_update', response: { cpuUsage: 0, processCpuUsage: 0 } });
    expect(valueCell('Host CPU')).toHaveTextContent('12 %');
    expect(valueCell('Process CPU')).toHaveTextContent('3 %');
  });

  test('should replace the listener when its context callbacks change and clean up on unmount', () => {
    const { context, rerenderTable, removeListener, listener, unmount } = renderTable();
    const nextAddListener = vi.fn();
    const nextRemoveListener = vi.fn();
    rerenderTable(false, { ...context, addListener: nextAddListener, removeListener: nextRemoveListener });
    expect(removeListener).toHaveBeenCalledExactlyOnceWith(listener);
    expect(nextAddListener).toHaveBeenCalledExactlyOnceWith(expect.any(Function), 42);
    unmount();
    expect(nextRemoveListener).toHaveBeenCalledExactlyOnceWith(nextAddListener.mock.calls[0][0]);
  });
});
