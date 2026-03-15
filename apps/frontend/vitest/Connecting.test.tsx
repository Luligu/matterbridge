import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../src/components/WebSocketProvider', () => ({
  WebSocketContext: React.createContext({ retry: 0 }),
}));

vi.mock('../src/components/MatterbridgeLogo', () => ({
  MatterbridgeLogo: ({ style }: { style?: React.CSSProperties }) => <div data-testid='matterbridge-logo' style={style}>Logo</div>,
}));

import { WebSocketContext } from '../src/components/WebSocketProvider';
import { Connecting } from '../src/components/Connecting';

describe('Connecting', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the reconnecting state while retry is below 100', () => {
    render(
      <WebSocketContext.Provider value={{ retry: 3 } as never}>
        <Connecting />
      </WebSocketContext.Provider>
    );

    expect(screen.getByTestId('matterbridge-logo')).toBeInTheDocument();
    expect(screen.getByText('Reconnecting to Matterbridge (attempt 3)...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh the Page' })).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders the failure state and refreshes the page when retry reaches 100', () => {
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadSpy },
      configurable: true,
      writable: true,
    });

    render(
      <WebSocketContext.Provider value={{ retry: 100 } as never}>
        <Connecting />
      </WebSocketContext.Provider>
    );

    expect(screen.getByText('Unable to connect to Matterbridge after multiple attempts.')).toBeInTheDocument();
    expect(screen.getByText('Please check your network connection.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh the Page' }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true,
    });
  });
});
