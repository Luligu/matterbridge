import '@testing-library/jest-dom';

import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiSettings } from '../src/utils/backendShared';

vi.mock('../src/appState', () => ({ debug: false, enableMobile: true }));
vi.mock('../src/components/Connecting', () => ({ Connecting: () => <div>Connecting</div> }));
vi.mock('../src/components/MbfPage', () => ({ MbfPage: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('../src/components/QRDiv', () => ({ default: ({ id }: { id: string | null }) => <div>QR: {id}</div> }));
vi.mock('../src/components/SystemInfoTable', () => ({ default: () => <div>System information</div> }));
vi.mock('../src/components/HomeInstallAddPlugins', () => ({ default: () => <div>Install plugins</div> }));
vi.mock('../src/components/HomePlugins', () => ({ default: ({ storeId }: { storeId: string | null }) => <div>Plugins: {storeId}</div> }));
vi.mock('../src/components/HomeDevices', () => ({ default: ({ storeId }: { storeId: string | null }) => <div>Devices: {storeId}</div> }));
vi.mock('../src/components/HomeLogs', () => ({ default: () => <div>Logs</div> }));
vi.mock('../src/components/HomeBrowserRefresh', () => ({ default: () => <div>Browser refresh</div> }));
vi.mock('../src/components/HomeShowChangelog', () => ({ default: () => <div>Changelog</div> }));
vi.mock('../src/components/MatterbridgeInfoTable', () => ({ default: () => <div>Matterbridge information</div> }));

import Home from '../src/components/Home';
import { UiContext, type UiContextType } from '../src/components/UiContext';
import { WebSocketContext, type WebSocketContextType } from '../src/components/WebSocketProvider';

const settings = {
  matterbridgeInformation: {
    matterbridgeVersion: '3.9.2',
    frontendVersion: '3.4.18',
    bridgeMode: 'bridge',
    readOnly: false,
  },
  systemInformation: { hostname: 'matterbridge' },
} as ApiSettings;

const uiContext = { mobile: false } as UiContextType;

describe('Home', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('requests data and displays the bridge dashboard after receiving it', async () => {
    const sendMessage = vi.fn();
    const removeListener = vi.fn();
    let listener: ((message: unknown) => void) | undefined;
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- This callback mirrors the WebSocket listener API.
    const addListener = vi.fn((callback: (message: unknown) => void) => {
      listener = callback;
    });
    const webSocketContext = { online: true, sendMessage, addListener, removeListener, getUniqueId: () => 17 } as unknown as WebSocketContextType;
    const { unmount } = render(
      <WebSocketContext.Provider value={webSocketContext}>
        <UiContext.Provider value={uiContext}>
          <Home />
        </UiContext.Provider>
      </WebSocketContext.Provider>,
    );

    expect(screen.getByText('Connecting')).toBeInTheDocument();
    expect(sendMessage).toHaveBeenCalledWith({ id: 17, sender: 'Home', method: '/api/settings', src: 'Frontend', dst: 'Matterbridge', params: {} });
    expect(sendMessage).toHaveBeenCalledWith({ id: 17, sender: 'Home', method: '/api/plugins', src: 'Frontend', dst: 'Matterbridge', params: {} });

    act(() => {
      listener?.({ method: '/api/settings', id: 17, response: settings });
      listener?.({ method: '/api/plugins', id: 17, response: [] });
    });

    await waitFor(() => expect(screen.getByText('QR: Matterbridge')).toBeInTheDocument());
    expect(screen.getByText('System information')).toBeInTheDocument();
    expect(screen.getByText('Install plugins')).toBeInTheDocument();
    expect(screen.getByText('Plugins: Matterbridge')).toBeInTheDocument();
    expect(screen.getByText('Devices: Matterbridge')).toBeInTheDocument();

    unmount();
    expect(removeListener).toHaveBeenCalled();
  });
});
