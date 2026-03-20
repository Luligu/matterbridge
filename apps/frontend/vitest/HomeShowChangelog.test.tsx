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

vi.mock('@mui/icons-material/HistoryOutlined', () => ({ default: () => <span data-testid='history-icon' /> }));
vi.mock('@mui/icons-material/Cancel', () => ({ default: () => <span data-testid='cancel-icon' /> }));
vi.mock('@mui/icons-material/Star', () => ({ default: () => <span data-testid='star-icon' /> }));
vi.mock('@mui/icons-material/Favorite', () => ({ default: () => <span data-testid='favorite-icon' /> }));

async function loadHomeShowChangelog(debug = false) {
  vi.resetModules();
  vi.doMock('../src/App', () => ({ debug }));
  return import('../src/components/HomeShowChangelog');
}

async function renderHomeShowChangelog(online: boolean, debug = false, changelog = 'https://example.com/changelog') {
  const { WebSocketContext } = await import('../src/components/WebSocketProvider');
  const module = await loadHomeShowChangelog(debug);
  const HomeShowChangelog = module.default;

  return render(
    <WebSocketContext.Provider value={{ online } as never}>
      <HomeShowChangelog changelog={changelog} />
    </WebSocketContext.Provider>
  );
}

describe('HomeShowChangelog', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Connecting component when offline', async () => {
    await renderHomeShowChangelog(false);

    expect(screen.getByTestId('connecting')).toBeInTheDocument();
    expect(screen.queryByText('Matterbridge Update')).not.toBeInTheDocument();
  });

  it('renders the changelog actions and triggers each one when online', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadSpy },
      configurable: true,
      writable: true,
    });

    await renderHomeShowChangelog(true, false, 'https://example.com/changelog');

    expect(screen.getByTestId('mbf-window')).toBeInTheDocument();
    expect(screen.getByText('Matterbridge Update')).toBeInTheDocument();
    expect(screen.getByText('Matterbridge has been updated.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Star' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sponsor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Changelog' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(openSpy).toHaveBeenNthCalledWith(1, 'https://github.com/Luligu/matterbridge', '_blank');
    expect(openSpy).toHaveBeenNthCalledWith(2, 'https://www.buymeacoffee.com/luligugithub', '_blank');
    expect(openSpy).toHaveBeenNthCalledWith(3, 'https://example.com/changelog', '_blank');
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true,
    });
  });

  it('logs when debug is enabled', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await renderHomeShowChangelog(true, true);

    expect(consoleSpy).toHaveBeenCalledWith('HomeShowChangelog rendering...');
  });
});
