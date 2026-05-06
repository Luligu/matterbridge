import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/components/WebSocketProvider', () => ({
  WebSocketContext: React.createContext({ online: true }),
}));

vi.mock('../src/components/Connecting', () => ({
  Connecting: () => <div data-testid='connecting'>Connecting</div>,
}));

vi.mock('../src/components/MbfWindow', () => ({
  MbfWindow: ({ children }: { children: React.ReactNode }) => <div data-testid='mbf-window'>{children}</div>,
  MbfWindowContent: ({ children, ...props }: { children: React.ReactNode }) => <div data-testid='mbf-window-content' {...props}>{children}</div>,
  MbfWindowHeader: ({ children }: { children: React.ReactNode }) => <div data-testid='mbf-window-header'>{children}</div>,
  MbfWindowHeaderText: ({ children }: { children: React.ReactNode }) => <div data-testid='mbf-window-header-text'>{children}</div>,
}));

vi.mock('@mui/material/Button', () => ({
  default: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock('@mui/icons-material/Refresh', () => ({
  default: () => <span data-testid='refresh-icon' />,
}));

async function loadHomeBrowserRefresh(debug = false) {
  vi.resetModules();
  vi.doMock('../src/App', () => ({ debug }));
  return import('../src/components/HomeBrowserRefresh');
}

async function renderHomeBrowserRefresh(online: boolean, debug = false, version = '3.4.14') {
  const { WebSocketContext } = await import('../src/components/WebSocketProvider');
  const module = await loadHomeBrowserRefresh(debug);
  const HomeBrowserRefresh = module.default;

  return render(
    <WebSocketContext.Provider value={{ online } as never}>
      <HomeBrowserRefresh version={version} />
    </WebSocketContext.Provider>
  );
}

describe('HomeBrowserRefresh', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Connecting component when offline', async () => {
    await renderHomeBrowserRefresh(false);

    expect(screen.getByTestId('connecting')).toBeInTheDocument();
    expect(screen.queryByText('Frontend Update')).not.toBeInTheDocument();
  });

  it('renders the refresh notice and reloads the page when online', async () => {
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadSpy },
      configurable: true,
      writable: true,
    });

    await renderHomeBrowserRefresh(true);

    expect(screen.getByTestId('mbf-window')).toBeInTheDocument();
    expect(screen.getByText('Frontend Update')).toBeInTheDocument();
    expect(screen.getByText('The frontend has been updated to version 3.4.14. You are viewing an outdated web UI. Please refresh the page now.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true,
    });
  });

  it('logs when debug is enabled', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await renderHomeBrowserRefresh(true, true);

    expect(consoleSpy).toHaveBeenCalledWith('HomeBrowserRefresh rendering...');
  });
});
