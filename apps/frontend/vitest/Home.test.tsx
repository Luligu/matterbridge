import '@testing-library/jest-dom';

import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiSettings, MatterbridgeInformation } from '../src/utils/backendShared';

vi.mock('../src/appState', () => ({ debug: false, enableMobile: true }));
vi.mock('../src/components/Connecting', () => ({ Connecting: () => <div>Connecting</div> }));
vi.mock('../src/components/MbfPage', () => ({ MbfPage: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('../src/components/QRDiv', () => ({ default: ({ id }: { id: string | null }) => <div>QR: {id ?? 'none'}</div> }));
vi.mock('../src/components/SystemInfoTable', () => ({ default: () => <div>System information</div> }));
vi.mock('../src/components/HomeInstallAddPlugins', () => ({ default: () => <div>Install plugins</div> }));
vi.mock('../src/components/HomePlugins', () => ({ default: ({ storeId }: { storeId: string | null }) => <div>Plugins: {storeId}</div> }));
vi.mock('../src/components/HomeDevices', () => ({ default: ({ storeId }: { storeId: string | null }) => <div>Devices: {storeId}</div> }));
vi.mock('../src/components/HomeLogs', () => ({ default: () => <div>Logs</div> }));
vi.mock('../src/components/HomeBrowserRefresh', () => ({ default: () => <div>Browser refresh</div> }));
vi.mock('../src/components/HomeShowChangelog', () => ({ default: () => <div>Changelog</div> }));
vi.mock('../src/components/MatterbridgeInfoTable', () => ({
  default: ({ matterbridgeInfo }: { matterbridgeInfo: MatterbridgeInformation }) => (
    <div>{`Versions: ${matterbridgeInfo.matterbridgeLatestVersion ?? '-'}/${matterbridgeInfo.matterbridgeDevVersion ?? '-'}`}</div>
  ),
}));

import Home from '../src/components/Home';
import { UiContext, type UiContextType } from '../src/components/UiContext';
import { WebSocketContext, type WebSocketContextType } from '../src/components/WebSocketProvider';
import { MbfLsk } from '../src/utils/localStorage';

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
const mobileUiContext = { mobile: true } as UiContextType;

const withInfo = (overrides: Partial<MatterbridgeInformation>) => ({
  ...settings,
  matterbridgeInformation: { ...settings.matterbridgeInformation, ...overrides },
});

const settingsRequest = { id: 17, sender: 'Home', method: '/api/settings', src: 'Frontend', dst: 'Matterbridge', params: {} };
const pluginsRequest = { id: 17, sender: 'Home', method: '/api/plugins', src: 'Frontend', dst: 'Matterbridge', params: {} };

function renderHome(ui: UiContextType = uiContext) {
  const sendMessage = vi.fn();
  const removeListener = vi.fn();
  let listener: ((message: unknown) => void) | undefined;
  // oxlint-disable-next-line promise/prefer-await-to-callbacks -- This callback mirrors the WebSocket listener API.
  const addListener = vi.fn((callback: (message: unknown) => void) => {
    listener = callback;
  });
  const webSocketContext = { online: true, sendMessage, addListener, removeListener, getUniqueId: () => 17 } as unknown as WebSocketContextType;
  render(
    <WebSocketContext.Provider value={webSocketContext}>
      <UiContext.Provider value={ui}>
        <Home />
      </UiContext.Provider>
    </WebSocketContext.Provider>,
  );
  const emit = (message: unknown) =>
    act(() => {
      listener?.(message);
    });
  return { sendMessage, removeListener, emit };
}

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

  it('defaults the store to the first plugin exposing a matter id in childbridge mode', async () => {
    const { emit } = renderHome();
    emit({ method: '/api/settings', id: 17, response: withInfo({ bridgeMode: 'childbridge' }) });
    emit({ method: '/api/plugins', id: 17, response: [{ name: 'no-matter' }, { name: 'with-matter', matter: { id: 'PluginStore' } }] });

    await waitFor(() => expect(screen.getByText('QR: PluginStore')).toBeInTheDocument());
    expect(screen.getByText('Plugins: PluginStore')).toBeInTheDocument();
    expect(screen.getByText('Devices: PluginStore')).toBeInTheDocument();
  });

  it('clears the plugins and the store and re-requests the data on refresh_required', async () => {
    const { sendMessage, emit } = renderHome();
    emit({ method: '/api/settings', id: 17, response: withInfo({ bridgeMode: 'childbridge' }) });
    emit({ method: '/api/plugins', id: 17, response: [{ name: 'with-matter', matter: { id: 'PluginStore' } }] });
    await waitFor(() => expect(screen.getByText('QR: PluginStore')).toBeInTheDocument());

    sendMessage.mockClear();
    emit({ method: 'refresh_required', response: { changed: 'settings' } });

    // The plugins are cleared, so the derived default has nothing left to pick.
    await waitFor(() => expect(screen.getByText('QR: none')).toBeInTheDocument());
    expect(sendMessage).toHaveBeenCalledWith(settingsRequest);
    expect(sendMessage).toHaveBeenCalledWith(pluginsRequest);
  });

  it('ignores a refresh_required for anything other than the settings', async () => {
    const { sendMessage, emit } = renderHome();
    emit({ method: '/api/settings', id: 17, response: settings });
    await waitFor(() => expect(screen.getByText('QR: Matterbridge')).toBeInTheDocument());

    sendMessage.mockClear();
    emit({ method: 'refresh_required', response: { changed: 'devices' } });

    expect(screen.getByText('QR: Matterbridge')).toBeInTheDocument();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('records the latest version reported by update_required', async () => {
    const { emit } = renderHome(mobileUiContext);
    emit({ method: '/api/settings', id: 17, response: settings });
    await waitFor(() => expect(screen.getByText('Versions: -/-')).toBeInTheDocument());

    emit({ method: 'update_required', response: { version: '3.9.3' } });
    await waitFor(() => expect(screen.getByText('Versions: 3.9.3/-')).toBeInTheDocument());
  });

  it('records the dev version reported by update_required', async () => {
    const { emit } = renderHome(mobileUiContext);
    emit({ method: '/api/settings', id: 17, response: settings });
    await waitFor(() => expect(screen.getByText('Versions: -/-')).toBeInTheDocument());

    emit({ method: 'update_required', response: { version: '3.9.4-dev.1', devVersion: true } });
    await waitFor(() => expect(screen.getByText('Versions: -/3.9.4-dev.1')).toBeInTheDocument());
  });

  it('prompts for a browser refresh when the frontend version changed', async () => {
    localStorage.setItem(MbfLsk.frontendVersion, '3.4.17');
    const { emit } = renderHome();
    emit({ method: '/api/settings', id: 17, response: settings });

    await waitFor(() => expect(screen.getByText('Browser refresh')).toBeInTheDocument());
    expect(localStorage.getItem(MbfLsk.frontendVersion)).toBe('3.4.18');
  });

  it('shows the changelog when the matterbridge version changed', async () => {
    localStorage.setItem(MbfLsk.frontendVersion, '3.4.18');
    localStorage.setItem(MbfLsk.matterbridgeVersion, '3.9.1');
    const { emit } = renderHome();
    emit({ method: '/api/settings', id: 17, response: settings });

    await waitFor(() => expect(screen.getByText('Changelog')).toBeInTheDocument());
    expect(screen.queryByText('Browser refresh')).not.toBeInTheDocument();
    expect(localStorage.getItem(MbfLsk.matterbridgeVersion)).toBe('3.9.2');
  });

  it('forces the devices page mode on a shelly board when no mode was stored', async () => {
    const { emit } = renderHome();
    emit({ method: '/api/settings', id: 17, response: withInfo({ shellyBoard: true }) });

    await waitFor(() => expect(localStorage.getItem(MbfLsk.homePageMode)).toBe('devices'));
    expect(screen.getByText('Devices: Matterbridge')).toBeInTheDocument();
  });
});
