import '@testing-library/jest-dom';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MbfLsk, resetLocalStorage } from '../src/utils/localStorage';

vi.mock('../src/appState', () => ({ debug: false }));

// Tooltip renders a Popper that warns about anchorEl in JSDOM.
vi.mock('@mui/material/Tooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../src/components/MbfPage', () => ({
  MbfPage: ({ children }: { children: React.ReactNode }) => <div data-testid="mbf-page">{children}</div>,
}));

vi.mock('../src/components/Connecting', () => ({
  Connecting: () => <div data-testid="connecting" />,
}));

vi.mock('../src/components/WebSocketLogs', () => ({
  default: () => <div data-testid="websocket-logs" />,
}));

vi.mock('../src/components/WebSocketProvider', async () => {
  const React = await import('react');
  return {
    WebSocketContext: React.createContext(null as unknown as Record<string, unknown>),
  };
});

import Logs from '../src/components/Logs';
import { WebSocketContext } from '../src/components/WebSocketProvider';

interface Ctx {
  logLength: { current: number };
  logAutoScroll: { current: boolean };
  setMessages: ReturnType<typeof vi.fn>;
  setLogLength: ReturnType<typeof vi.fn>;
  setLogAutoScroll: ReturnType<typeof vi.fn>;
  setLogFilterLevel: ReturnType<typeof vi.fn>;
  setLogFilterSearch: ReturnType<typeof vi.fn>;
  filterLogMessages: ReturnType<typeof vi.fn>;
  online: boolean;
}

const makeCtx = (overrides: Partial<Ctx> = {}): Ctx => ({
  logLength: { current: 200 },
  logAutoScroll: { current: true },
  setMessages: vi.fn(),
  setLogLength: vi.fn(),
  setLogAutoScroll: vi.fn(),
  setLogFilterLevel: vi.fn(),
  setLogFilterSearch: vi.fn(),
  filterLogMessages: vi.fn(),
  online: true,
  ...overrides,
});

const renderLogs = (ctx: Ctx) => {
  render(
    <WebSocketContext.Provider value={ctx as any}>
      <Logs />
    </WebSocketContext.Provider>,
  );
  return ctx;
};

// The level Select is the first combobox, the log length Select the second.
const levelSelect = () => screen.getAllByRole('combobox')[0];
const lengthSelect = () => screen.getAllByRole('combobox')[1];
const searchInput = () => document.querySelector<HTMLInputElement>('#logsearch')!;
const autoScrollCheckbox = () => screen.getByRole('checkbox');

const pickOption = async (combobox: HTMLElement, name: string) => {
  combobox.getBoundingClientRect = () => ({ width: 100, height: 20, top: 0, left: 0, bottom: 20, right: 100, x: 0, y: 0, toJSON: () => ({}) });
  act(() => {
    fireEvent.mouseDown(combobox);
  });
  const option = await screen.findByRole('option', { name }).catch(async () => screen.findByRole('menuitem', { name }));
  act(() => {
    fireEvent.click(option);
  });
};

describe('Logs', () => {
  beforeEach(() => {
    resetLocalStorage();
    vi.clearAllMocks();
  });

  it('renders Connecting and no toolbar while offline', () => {
    renderLogs(makeCtx({ online: false }));

    expect(screen.getByTestId('connecting')).toBeInTheDocument();
    expect(screen.queryByTestId('mbf-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('websocket-logs')).not.toBeInTheDocument();
  });

  it('renders the toolbar and the log stream when online', () => {
    renderLogs(makeCtx());

    expect(screen.getByTestId('mbf-page')).toBeInTheDocument();
    expect(screen.getByTestId('websocket-logs')).toBeInTheDocument();
    expect(screen.queryByTestId('connecting')).not.toBeInTheDocument();
  });

  it('falls back to the default level and search when nothing is stored', () => {
    renderLogs(makeCtx());

    expect(levelSelect()).toHaveTextContent('Info');
    expect(searchInput()).toHaveValue('*');
  });

  it('restores the level and the search from localStorage', () => {
    localStorage.setItem(MbfLsk.logFilterLevel, 'warn');
    localStorage.setItem(MbfLsk.logFilterSearch, 'matterbridge');

    renderLogs(makeCtx());

    expect(levelSelect()).toHaveTextContent('Warn');
    expect(searchInput()).toHaveValue('matterbridge');
  });

  it('takes the log length and the auto scroll from the context refs, not from localStorage', () => {
    // Stale localStorage values must lose to the refs the provider owns.
    localStorage.setItem(MbfLsk.logLength, '100');
    localStorage.setItem(MbfLsk.logAutoScroll, 'true');

    renderLogs(makeCtx({ logLength: { current: 1000 }, logAutoScroll: { current: false } }));

    expect(lengthSelect()).toHaveTextContent('1000');
    expect(autoScrollCheckbox()).not.toBeChecked();
  });

  it('applies a level change to the context, the filter and localStorage', async () => {
    const ctx = renderLogs(makeCtx());

    await pickOption(levelSelect(), 'Error');

    expect(ctx.setLogFilterLevel).toHaveBeenCalledWith('error');
    // The current search must be carried through unchanged.
    expect(ctx.filterLogMessages).toHaveBeenCalledWith('error', '*');
    expect(localStorage.getItem(MbfLsk.logFilterLevel)).toBe('error');
    await waitFor(() => expect(levelSelect()).toHaveTextContent('Error'));
  });

  it('applies a search change to the context, the filter and localStorage', () => {
    const ctx = renderLogs(makeCtx());

    fireEvent.change(searchInput(), { target: { value: '/warn|error/' } });

    expect(ctx.setLogFilterSearch).toHaveBeenCalledWith('/warn|error/');
    // The current level must be carried through unchanged.
    expect(ctx.filterLogMessages).toHaveBeenCalledWith('info', '/warn|error/');
    expect(localStorage.getItem(MbfLsk.logFilterSearch)).toBe('/warn|error/');
    expect(searchInput()).toHaveValue('/warn|error/');
  });

  it('filters with the level and the search that are both current', async () => {
    const ctx = renderLogs(makeCtx());

    await pickOption(levelSelect(), 'Debug');
    fireEvent.change(searchInput(), { target: { value: 'plugin' } });

    // The second call must combine the new level with the new search.
    expect(ctx.filterLogMessages).toHaveBeenLastCalledWith('debug', 'plugin');
  });

  it('turns auto scroll off through the setter and persists it', () => {
    const ctx = renderLogs(makeCtx({ logAutoScroll: { current: true } }));

    fireEvent.click(autoScrollCheckbox());

    expect(ctx.setLogAutoScroll).toHaveBeenCalledWith(false);
    expect(ctx.filterLogMessages).toHaveBeenCalledWith('info', '*');
    expect(localStorage.getItem(MbfLsk.logAutoScroll)).toBe('false');
    expect(autoScrollCheckbox()).not.toBeChecked();
  });

  it('turns auto scroll back on through the setter and persists it', () => {
    const ctx = renderLogs(makeCtx({ logAutoScroll: { current: false } }));

    fireEvent.click(autoScrollCheckbox());

    expect(ctx.setLogAutoScroll).toHaveBeenCalledWith(true);
    expect(localStorage.getItem(MbfLsk.logAutoScroll)).toBe('true');
    expect(autoScrollCheckbox()).toBeChecked();
  });

  it('never writes the context refs directly', () => {
    // The setters are inert mocks here, so a direct `ref.current = ...` write would show up.
    const ctx = renderLogs(makeCtx({ logLength: { current: 200 }, logAutoScroll: { current: true } }));

    fireEvent.click(autoScrollCheckbox());

    expect(ctx.setLogAutoScroll).toHaveBeenCalledWith(false);
    expect(ctx.logAutoScroll.current).toBe(true);
    expect(ctx.logLength.current).toBe(200);
  });

  it('applies a log length change as a number and persists it', async () => {
    const ctx = renderLogs(makeCtx());

    await pickOption(lengthSelect(), '500');

    expect(ctx.setLogLength).toHaveBeenCalledWith(500);
    expect(localStorage.getItem(MbfLsk.logLength)).toBe('500');
    await waitFor(() => expect(lengthSelect()).toHaveTextContent('500'));
  });

  it('clears the messages', () => {
    const ctx = renderLogs(makeCtx());

    fireEvent.click(screen.getByRole('button', { name: /clear/i }));

    expect(ctx.setMessages).toHaveBeenCalledWith([]);
  });
});
