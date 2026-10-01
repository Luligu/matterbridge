import { act, cleanup, renderHook } from '@testing-library/react';
import { useContext, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { UiContext, type UiContextType } from '../src/components/UiContext';
import { WebSocketContext, WebSocketMessagesContext, WebSocketProvider, type WsLogMessage } from '../src/components/WebSocketProvider';
import { type WsMessageApiRequest } from '../src/utils/backendShared';
import { MbfLsk } from '../src/utils/localStorage';

const appState = vi.hoisted(() => ({ debug: false, isIngress: false, wssPassword: '' }));
vi.mock('../src/appState', () => appState);

class MockWebSocket {
  public static readonly OPEN = 1;
  public static instances: MockWebSocket[] = [];
  public readyState = 0;
  public onopen: (() => void) | null = null;
  public onclose: (() => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;
  public send = vi.fn<(data: string) => void>();
  public close = vi.fn(() => {
    this.readyState = 3;
  });

  public constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  public open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  public disconnect() {
    this.readyState = 3;
    this.onclose?.();
  }

  public receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

const ui = {
  mobile: false,
  currentPage: null,
  installAutoExit: true,
  setMobile: vi.fn(),
  setCurrentPage: vi.fn(),
  showSnackbarMessage: vi.fn(),
  closeSnackbarMessage: vi.fn(),
  closeSnackbar: vi.fn(),
  showConfirmCancelDialog: vi.fn(),
  showInstallProgress: vi.fn(),
  exitInstallProgressSuccess: vi.fn(),
  exitInstallProgressError: vi.fn(),
  hideInstallProgress: vi.fn(),
  addInstallProgress: vi.fn(),
  setInstallAutoExit: vi.fn(),
} satisfies UiContextType;

function renderProvider() {
  return renderHook(() => ({ socket: useContext(WebSocketContext), logs: useContext(WebSocketMessagesContext) }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <UiContext.Provider value={ui}>
        <WebSocketProvider>{children}</WebSocketProvider>
      </UiContext.Provider>
    ),
  });
}

function latestSocket() {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1];
}

function response(method: string, value: unknown, id = 42) {
  return { id, src: 'Matterbridge', dst: 'Frontend', method, response: value };
}

function log(level = 'info', message = 'Device ready', name = 'Device'): WsLogMessage {
  return { level, time: '12:00:00', name, message };
}

function advance(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  appState.debug = false;
  appState.isIngress = false;
  appState.wssPassword = '';
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.spyOn(Math, 'random').mockReturnValue(0);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe.each([false, true])('WebSocketProvider with debug=%s', (debug) => {
  beforeEach(() => {
    appState.debug = debug;
  });

  test('should expose defaults and shared log controls when mounted', () => {
    const { result, unmount } = renderProvider();
    expect(latestSocket().url).toBe(window.location.href.replace(/^http/, 'ws'));
    expect(result.current.socket.online).toBe(false);
    expect(result.current.socket.retry).toBe(1);
    expect(result.current.logs.logLength.current).toBe(200);
    expect(result.current.logs.logAutoScroll.current).toBe(true);
    expect(result.current.logs.logFilterLevel).toBe('info');
    expect(result.current.logs.logFilterSearch).toBe('*');
    expect(result.current.socket.getUniqueId()).toBe(1000);
    vi.mocked(Math.random).mockReturnValue(0.999999);
    expect(result.current.socket.getUniqueId()).toBe(999999);
    act(() => {
      result.current.socket.setMessages([]);
      result.current.socket.setLogLength(2);
      result.current.socket.setLogAutoScroll(false);
      result.current.socket.logMessage('Test', 'Local message');
    });
    expect(result.current.logs.messages).toEqual([{ level: 'Test', time: '', name: '', message: 'Local message' }]);
    expect(result.current.logs.logLength.current).toBe(2);
    expect(result.current.logs.logAutoScroll.current).toBe(false);
    expect(result.current.socket.setLogLength).toBe(result.current.logs.setLogLength);
    advance(10_000);
    unmount();
    expect(latestSocket().close).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('should load persisted preferences and encode the password when connecting', () => {
    appState.wssPassword = 'secret &?';
    localStorage.setItem(MbfLsk.logLength, '10');
    localStorage.setItem(MbfLsk.logAutoScroll, 'false');
    localStorage.setItem(MbfLsk.logFilterLevel, 'warn');
    localStorage.setItem(MbfLsk.logFilterSearch, 'device');
    const { result, unmount } = renderProvider();
    expect(latestSocket().url).toBe(`${window.location.href.replace(/^http/, 'ws')}?password=secret%20%26%3F`);
    expect(result.current.logs.logLength.current).toBe(10);
    expect(result.current.logs.logAutoScroll.current).toBe(false);
    expect(result.current.logs.logFilterLevel).toBe('warn');
    expect(result.current.logs.logFilterSearch).toBe('device');
    act(() => latestSocket().open());
    expect(result.current.socket.online).toBe(true);
    expect(ui.closeSnackbar).toHaveBeenCalledExactlyOnceWith();
    unmount();
    expect(latestSocket().close).toHaveBeenCalledExactlyOnceWith();
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain(appState.wssPassword);
  });

  test('should send only on an open socket and preserve explicit request IDs', () => {
    const { result } = renderProvider();
    const socket = latestSocket();
    const request: WsMessageApiRequest = { id: 1000, method: 'ping', src: 'Frontend', dst: 'Matterbridge', params: {} };
    Reflect.deleteProperty(request, 'id');
    act(() => result.current.socket.sendMessage(request));
    expect(socket.send).not.toHaveBeenCalled();
    act(() => {
      socket.open();
      result.current.socket.sendMessage(request);
      result.current.socket.sendMessage({ ...request, id: 55 });
    });
    expect(socket.send).toHaveBeenNthCalledWith(1, JSON.stringify({ ...request, id: 1000 }));
    expect(socket.send).toHaveBeenNthCalledWith(2, JSON.stringify({ ...request, id: 55 }));
    socket.send.mockImplementationOnce(() => {
      throw new Error('send failed');
    });
    expect(() => result.current.socket.sendMessage(request)).not.toThrow();
    expect(socket.send).toHaveBeenCalledTimes(3);
  });

  test('should route targeted and broadcast responses and remove listeners', () => {
    const { result } = renderProvider();
    const first = vi.fn();
    const second = vi.fn();
    act(() => {
      result.current.socket.addListener(first, 42);
      result.current.socket.addListener(second, 43);
      latestSocket().receive(response('update', {}, 43));
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledExactlyOnceWith(response('update', {}, 43));
    act(() => latestSocket().receive(response('update', {}, 0)));
    expect(first).toHaveBeenCalledExactlyOnceWith(response('update', {}, 0));
    expect(second).toHaveBeenCalledTimes(2);
    act(() => {
      result.current.socket.removeListener(first);
      latestSocket().receive(response('update', {}, 42));
      latestSocket().receive(response('update', {}, 0));
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(3);
  });

  test.each([undefined, null, Number.NaN, 0])('should report invalid listener ID %s when registering', (id) => {
    const { result } = renderProvider();
    const listener = vi.fn();
    Reflect.apply(result.current.socket.addListener, undefined, [listener, id]);
    expect(console.error).toHaveBeenCalledExactlyOnceWith('WebSocket addListener called without id, listener not added:', listener);
  });

  test('should skip connecting when the host is empty', () => {
    const browserWindow = window;
    vi.stubGlobal(
      'window',
      new Proxy(browserWindow, {
        get(target, property) {
          return property === 'location' ? { href: '' } : Reflect.get(target, property, target);
        },
      }),
    );
    const { result } = renderProvider();
    expect(MockWebSocket.instances).toEqual([]);
    expect(result.current.socket.online).toBe(false);
    expect(result.current.logs.messages).toEqual([]);
    act(() => result.current.socket.sendMessage({ id: 42, src: 'Frontend', dst: 'Matterbridge', method: 'ping', params: {} }));
    expect(MockWebSocket.instances).toEqual([]);
  });

  test('should contain non-Error callback failures and process later responses', () => {
    const { result } = renderProvider();
    const listener = vi.fn().mockImplementationOnce(() => {
      throw 'Listener failed';
    });
    result.current.socket.addListener(listener, 42);
    act(() => latestSocket().receive(response('update', {})));
    expect(console.error).toHaveBeenCalledExactlyOnceWith('WebSocket error parsing message: Listener failed', null);
    act(() => latestSocket().receive(response('update', {})));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  test('should reject malformed messages and keep handling subsequent messages', () => {
    const { result } = renderProvider();
    const listener = vi.fn();
    result.current.socket.addListener(listener, 42);
    act(() => {
      for (const message of [
        {},
        { id: 42 },
        { id: 42, src: 'Matterbridge' },
        { ...response('update', {}), src: 'Other' },
        { ...response('update', {}), dst: 'Other' },
        { ...response('update', {}), error: 'Failed' },
      ])
        latestSocket().receive(message);
      latestSocket().onmessage?.({ data: '{' });
      latestSocket().receive(null);
    });
    expect(listener).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('WebSocket error parsing message:'), expect.any(String));
    act(() => latestSocket().receive(response('update', {})));
    expect(listener).toHaveBeenCalledExactlyOnceWith(response('update', {}));
    expect(result.current.socket.online).toBe(true);
    advance(10_000);
    advance(10_000);
  });

  test('should forward snackbar and installation messages to the UI', () => {
    renderProvider();
    act(() => {
      latestSocket().receive(response('snackbar', { message: 'Installing', timeout: 5, severity: 'info' }));
      latestSocket().receive(response('close_snackbar', { message: 'Installing' }));
      for (const name of ['Matterbridge:spawn-init', 'Matterbridge:spawn-exit-success', 'Matterbridge:spawn-exit-error', 'npm']) {
        latestSocket().receive(response('log', log('spawn', 'Install output', name)));
      }
    });
    expect(ui.showSnackbarMessage).toHaveBeenCalledExactlyOnceWith('Installing', 5, 'info');
    expect(ui.closeSnackbarMessage).toHaveBeenCalledExactlyOnceWith('Installing');
    expect(ui.showInstallProgress).toHaveBeenCalledExactlyOnceWith('Install output', '', '');
    expect(ui.exitInstallProgressSuccess).toHaveBeenCalledExactlyOnceWith();
    expect(ui.exitInstallProgressError).toHaveBeenCalledExactlyOnceWith();
    expect(ui.addInstallProgress).toHaveBeenCalledExactlyOnceWith('Install output\n');
  });

  test.each(['debug', 'info', 'notice', 'warn', 'error', 'fatal'])('should apply the %s severity to incoming and existing logs', (level) => {
    const { result } = renderProvider();
    const levels = ['debug', 'info', 'notice', 'warn', 'error', 'fatal'];
    const entries = [...levels.map((entry) => log(entry)), log('spawn')];
    const expected = [...levels.slice(levels.indexOf(level)).map((entry) => log(entry)), log('spawn')];
    act(() => {
      result.current.logs.setLogFilterLevel(level);
      result.current.logs.setMessages([]);
    });
    act(() => {
      for (const entry of entries) latestSocket().receive(response('log', entry));
    });
    expect(result.current.logs.messages).toEqual(expected);
    act(() => result.current.logs.setMessages(entries));
    act(() => result.current.logs.filterLogMessages(level, '*'));
    expect(result.current.logs.messages).toEqual(expected);
  });

  test.each([
    ['*', 3],
    ['', 3],
    ['DEVICE', 2],
    ['absent', 0],
    ['/device/', 2],
    ['/absent/', 0],
    ['/[/', 3],
    ['/device', 3],
    ['device/', 3],
  ])('should apply search %s to incoming and existing logs', (search, count) => {
    const { result } = renderProvider();
    const entries = [log('info', 'Device ready', 'Bridge'), log('info', 'Ready', 'Device'), log('info', 'Ready', 'Bridge')];
    act(() => {
      result.current.logs.setLogFilterSearch(search);
      result.current.logs.setMessages([]);
    });
    act(() => {
      for (const entry of entries) latestSocket().receive(response('log', entry));
    });
    expect(result.current.logs.messages).toEqual(entries.slice(0, count));
    act(() => result.current.logs.setMessages(entries));
    act(() => result.current.logs.filterLogMessages('info', search));
    expect(result.current.logs.messages).toEqual(entries.slice(0, count));
  });

  test('should discard incomplete and uncommissioned logs and trim the buffer past its allowance', () => {
    const { result } = renderProvider();
    act(() => {
      result.current.logs.setMessages([]);
      result.current.logs.setLogLength(10);
    });
    act(() => {
      for (const entry of [null, {}, { level: 'info' }, { level: 'info', time: 'now' }, { level: 'info', time: 'now', name: 'Device' }]) {
        latestSocket().receive(response('log', entry));
      }
      latestSocket().receive(response('log', log('info', 'Device is uncommissioned', 'Commissioning')));
    });
    expect(result.current.logs.messages).toEqual([]);
    act(() => {
      for (let index = 0; index < 11; index++) latestSocket().receive(response('log', log('info', String(index))));
    });
    expect(result.current.logs.messages).toHaveLength(11);
    act(() => latestSocket().receive(response('log', log('info', 'Commissioned', 'Commissioning'))));
    expect(result.current.logs.messages).toHaveLength(10);
    expect(result.current.logs.messages[0]?.message).toBe('2');
    expect(result.current.logs.messages[9]?.message).toBe('Commissioned');
  });

  test('should ping after startup, cancel offline detection for pong, and mark unanswered pings offline', () => {
    const { result } = renderProvider();
    const socket = latestSocket();
    act(() => socket.open());
    advance(359_999);
    expect(socket.send).not.toHaveBeenCalled();
    advance(1);
    expect(socket.send).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ id: 1000, method: 'ping', src: 'Frontend', dst: 'Matterbridge', params: {} }));
    act(() => socket.receive(response('pong', 'pong', 1000)));
    act(() => socket.receive(response('pong', 'pong', 1000)));
    advance(50_000);
    expect(result.current.socket.online).toBe(true);
    advance(10_000);
    advance(50_000);
    expect(result.current.socket.online).toBe(false);
    expect(result.current.logs.messages).toContainEqual(expect.objectContaining({ message: expect.stringContaining('No pong response received') }));
    advance(10_000);
    act(() => socket.disconnect());
    expect(ui.hideInstallProgress).toHaveBeenCalledExactlyOnceWith();
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(result.current.socket.retry).toBe(2);
    advance(60_000);
    expect(socket.send).toHaveBeenCalledTimes(3);
  });

  test('should retry immediately then back off and reset retries when connected', () => {
    const { result } = renderProvider();
    act(() => latestSocket().onerror?.(new Event('error')));
    expect(result.current.logs.messages).toContainEqual(expect.objectContaining({ message: expect.stringContaining('WebSocket error connecting') }));
    act(() => latestSocket().disconnect());
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(result.current.socket.retry).toBe(2);
    act(() => latestSocket().disconnect());
    advance(1999);
    expect(MockWebSocket.instances).toHaveLength(2);
    advance(1);
    expect(MockWebSocket.instances).toHaveLength(3);
    act(() => latestSocket().open());
    expect(result.current.socket.retry).toBe(1);
    expect(result.current.socket.online).toBe(true);
  });

  test('should stop reconnecting when the retry limit is reached', () => {
    const { result } = renderProvider();
    for (let attempt = 1; attempt <= 100; attempt++) {
      act(() => latestSocket().disconnect());
      advance(attempt * 1000);
    }
    expect(MockWebSocket.instances).toHaveLength(100);
    expect(result.current.socket.retry).toBe(101);
    expect(result.current.logs.messages).toContainEqual(expect.objectContaining({ message: expect.stringContaining('Reconnect attempts exceeded limit of 100 retries') }));
    advance(100_000);
    expect(MockWebSocket.instances).toHaveLength(100);
  });

  test('should reconnect after five seconds when running behind ingress', () => {
    appState.isIngress = true;
    renderProvider();
    act(() => latestSocket().disconnect());
    advance(4999);
    expect(MockWebSocket.instances).toHaveLength(1);
    advance(1);
    expect(MockWebSocket.instances).toHaveLength(2);
  });
});
