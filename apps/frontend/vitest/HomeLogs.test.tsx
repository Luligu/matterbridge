import '@testing-library/jest-dom';

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import HomeLogs from '../src/components/HomeLogs';
import { WebSocketContext, type WebSocketContextType } from '../src/components/WebSocketProvider';
import { MbfLsk } from '../src/utils/localStorage';

const settings = vi.hoisted(() => ({ debug: false }));
vi.mock('../src/appState', () => settings);
vi.mock('../src/components/Connecting', () => ({ Connecting: () => <output>Connecting</output> }));
vi.mock('../src/components/WebSocketLogs', () => ({ default: () => <div data-testid="log-stream">Live logs</div> }));

function renderLogs(online = true, autoScroll = true) {
  const logAutoScroll = { current: autoScroll };
  const view = (connected: boolean) => (
    <WebSocketContext.Provider value={{ online: connected, logAutoScroll } as WebSocketContextType}>
      <HomeLogs />
    </WebSocketContext.Provider>
  );
  const result = render(view(online));
  return { ...result, logAutoScroll, rerenderOnline: (connected: boolean) => result.rerender(view(connected)) };
}

beforeEach(() => {
  settings.debug = false;
  localStorage.clear();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('HomeLogs', () => {
  test('should show Connecting instead of the log window when offline', () => {
    renderLogs(false);
    expect(screen.getByRole('status')).toHaveTextContent('Connecting');
    expect(screen.queryByText('Logs')).not.toBeInTheDocument();
    expect(screen.queryByTestId('log-stream')).not.toBeInTheDocument();
  });

  test('should use default filters and auto scrolling when preferences are absent', () => {
    renderLogs();
    expect(screen.getByText('Logs')).toBeInTheDocument();
    expect(screen.getByText('Filter: logger level "info" and search "*" Scroll: auto')).toBeInTheDocument();
    expect(screen.getByTestId('log-stream')).toHaveTextContent('Live logs');
    expect(localStorage.getItem(MbfLsk.logFilterLevel)).toBeNull();
    expect(localStorage.getItem(MbfLsk.logFilterSearch)).toBeNull();
  });

  test.each([
    { level: 'debug', search: 'plugin-name', expectedSearch: 'plugin-name' },
    { level: 'warn', search: '', expectedSearch: '*' },
    { level: '', search: '*', expectedSearch: '*' },
  ])('should display stored preferences for level "$level" and search "$search"', ({ level, search, expectedSearch }) => {
    localStorage.setItem(MbfLsk.logFilterLevel, level);
    localStorage.setItem(MbfLsk.logFilterSearch, search);
    renderLogs(true, false);
    expect(screen.getByText(`Filter: logger level "${level}" and search "${expectedSearch}" Scroll: manual`)).toBeInTheDocument();
    expect(localStorage.getItem(MbfLsk.logFilterSearch)).toBe(search);
  });

  test('should switch connection and scroll displays while retaining initialized filters', () => {
    localStorage.setItem(MbfLsk.logFilterLevel, 'error');
    localStorage.setItem(MbfLsk.logFilterSearch, 'initial');
    const { rerenderOnline, logAutoScroll } = renderLogs(false);
    expect(screen.getByRole('status')).toBeInTheDocument();
    rerenderOnline(true);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByTestId('log-stream')).toBeInTheDocument();
    localStorage.setItem(MbfLsk.logFilterLevel, 'debug');
    localStorage.setItem(MbfLsk.logFilterSearch, 'new');
    logAutoScroll.current = false;
    rerenderOnline(true);
    expect(screen.getByText('Filter: logger level "error" and search "initial" Scroll: manual')).toBeInTheDocument();
    rerenderOnline(false);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('log-stream')).not.toBeInTheDocument();
  });

  test.each([false, true])('should respect debug=%s when rendering', (debug) => {
    settings.debug = debug;
    renderLogs();
    expect(vi.mocked(console.log).mock.calls).toEqual(debug ? [['HomeLogs rendering...']] : []);
  });
});
