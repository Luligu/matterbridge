import '@testing-library/jest-dom';

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import WebSocketLogs from '../src/components/WebSocketLogs';
import { WebSocketMessagesContext, type WebSocketMessagesContextType } from '../src/components/WebSocketProvider';

const appState = vi.hoisted(() => ({ debug: false }));

vi.mock('../src/appState', () => appState);
vi.mock('../src/components/WebSocketProvider', async () => {
  const { createContext } = await import('react');
  return { WebSocketMessagesContext: createContext<WebSocketMessagesContextType | null>(null) };
});

const touchDescriptor = Object.getOwnPropertyDescriptor(window, 'ontouchstart');
const scrollDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
const scrollIntoView = vi.fn();

const makeContext = (overrides: Partial<WebSocketMessagesContextType> = {}): WebSocketMessagesContextType => ({
  messages: [],
  logLength: { current: 200 },
  logFilterLevel: 'info',
  logFilterSearch: '*',
  logAutoScroll: { current: true },
  setMessages: vi.fn(),
  setLogLength: vi.fn(),
  setLogAutoScroll: vi.fn(),
  setLogFilterLevel: vi.fn(),
  setLogFilterSearch: vi.fn(),
  filterLogMessages: vi.fn(),
  ...overrides,
});

const logView = (context: WebSocketMessagesContextType) => (
  <WebSocketMessagesContext.Provider value={context}>
    <WebSocketLogs />
  </WebSocketMessagesContext.Provider>
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  appState.debug = false;
  scrollIntoView.mockClear();
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
  Reflect.deleteProperty(window, 'ontouchstart');
  vi.stubGlobal('DocumentTouch', undefined);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (touchDescriptor) Object.defineProperty(window, 'ontouchstart', touchDescriptor);
  else Reflect.deleteProperty(window, 'ontouchstart');
  if (scrollDescriptor) Object.defineProperty(Element.prototype, 'scrollIntoView', scrollDescriptor);
  else Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
});

describe('WebSocketLogs rendering', () => {
  test('should render all badge colors and optional metadata when messages are provided', () => {
    const levels = [
      ['DEBUG', 'gray', 'white'],
      ['info', 'rgb(38, 127, 183)', 'white'],
      ['notice', 'green', 'white'],
      ['WARN', 'rgb(233, 219, 24)', 'black'],
      ['error', 'red', 'white'],
      ['fatal', 'rgb(255, 0, 0)', 'white'],
      ['spawn', 'rgb(255, 0, 208)', 'white'],
      ['custom', 'rgb(92, 14, 145)', 'white'],
    ];
    render(
      logView(
        makeContext({
          messages: levels.map(([level]) => ({ level, time: '12:34:56', name: 'Bridge', message: `${level} message` })),
        }),
      ),
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(levels.length);
    expect(screen.getAllByText('[12:34:56]')).toHaveLength(levels.length);
    expect(screen.getAllByText('[Bridge]')).toHaveLength(levels.length);
    for (const [level, backgroundColor, color] of levels) {
      expect(screen.getByText(level).style.backgroundColor).toBe(backgroundColor);
      expect(screen.getByText(level).style.color).toBe(color);
      expect(screen.getByText(`${level} message`)).toBeInTheDocument();
    }
  });

  test('should update the list and omit empty metadata when context messages change', () => {
    const context = makeContext();
    const { rerender } = render(logView(context));
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);

    rerender(logView({ ...context, messages: [{ level: 'info', time: '', name: '', message: 'New message' }] }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('listitem')).toHaveTextContent('infoNew message');
    expect(within(screen.getByRole('listitem')).queryByText(/\[/)).not.toBeInTheDocument();

    rerender(logView({ ...context, messages: [] }));
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});

describe.each([false, true])('WebSocketLogs auto-scroll with debug=%s', (debug) => {
  beforeEach(() => {
    appState.debug = debug;
  });

  test('should scroll immediately when updates are at least 500 milliseconds apart', () => {
    const context = makeContext();
    const { rerender } = render(logView(context));
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth', block: 'end' });

    act(() => {
      vi.advanceTimersByTime(500);
    });
    rerender(logView({ ...context, messages: [] }));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'end' });
    expect(vi.getTimerCount()).toBe(0);
  });

  test('should replace the pending scroll and update its timestamp when messages arrive rapidly', () => {
    const context = makeContext();
    const { rerender } = render(logView(context));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender(logView({ ...context, messages: [] }));
    expect(vi.getTimerCount()).toBe(1);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender(logView({ ...context, messages: [] }));
    expect(vi.getTimerCount()).toBe(1);
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth' });

    rerender(logView({ ...context, messages: [] }));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
  });

  test('should skip scrolling when auto-scroll is disabled', () => {
    render(logView(makeContext({ logAutoScroll: { current: false } })));
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('should pause on hover and resume when the mouse leaves', () => {
    const context = makeContext();
    const { rerender } = render(logView(context));
    const list = screen.getByRole('list');
    fireEvent.mouseEnter(list);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    rerender(logView({ ...context, messages: [] }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.mouseLeave(list);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  test('should skip scrolling when touch events are supported', () => {
    Object.defineProperty(window, 'ontouchstart', { configurable: true, value: null });
    render(logView(makeContext()));
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('should skip scrolling when the document implements the legacy touch interface', () => {
    vi.stubGlobal('DocumentTouch', Document);
    render(logView(makeContext()));
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('should scroll when the document does not implement the legacy touch interface', () => {
    vi.stubGlobal('DocumentTouch', HTMLElement);
    render(logView(makeContext()));
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth', block: 'end' });
  });

  test('should tolerate a pending scroll when the component has unmounted', () => {
    const context = makeContext();
    const { rerender, unmount } = render(logView(context));
    rerender(logView({ ...context, messages: [] }));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
