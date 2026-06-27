import '@testing-library/jest-dom';

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiSettings } from '../src/utils/backendShared';

vi.mock('@mui/material/Tooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../src/appState', () => ({
  clearEnableMobile: vi.fn(),
  debug: false,
  enableMobile: true,
  setEnableMobile: vi.fn(),
  toggleDebug: vi.fn(),
}));

import { toggleDebug } from '../src/appState';
import Header from '../src/components/Header';
import { UiContext, type UiContextType } from '../src/components/UiContext';
import { WebSocketContext, type WebSocketContextType } from '../src/components/WebSocketProvider';

const settings = {
  matterbridgeInformation: {
    rootDirectory: '',
    homeDirectory: '',
    matterbridgeDirectory: '',
    matterbridgePluginDirectory: '',
    matterbridgeCertDirectory: '',
    globalModulesDirectory: '',
    matterbridgeVersion: '3.9.2',
    matterbridgeLatestVersion: '3.9.3',
    matterbridgeDevVersion: '',
    frontendVersion: '3.4.18',
    dockerDev: undefined,
    dockerVersion: undefined,
    dockerLatestVersion: undefined,
    dockerDevVersion: undefined,
    bridgeMode: 'none',
    restartMode: 'none',
    virtualMode: 'disabled',
    profile: undefined,
    readOnly: false,
    shellyBoard: false,
    shellySysUpdate: false,
    shellyMainUpdate: false,
    loggerLevel: 'info',
    fileLogger: false,
    matterLoggerLevel: 'info',
    matterFileLogger: false,
    matterMdnsInterface: undefined,
    matterIpv4Address: undefined,
    matterIpv6Address: undefined,
    matterPort: 5540,
    matterDiscriminator: undefined,
    matterPasscode: undefined,
    restartRequired: false,
    fixedRestartRequired: false,
    updateRequired: false,
  },
  systemInformation: {
    interfaceName: '',
    macAddress: '',
    ipv4Address: '',
    ipv6Address: '',
    nodeVersion: '',
    hostname: '',
    user: '',
    osType: '',
    osRelease: '',
    osPlatform: '',
    osArch: '',
    totalMemory: '',
    freeMemory: '',
    systemUptime: '',
    processUptime: '',
    cpuUsage: '',
    processCpuUsage: '',
    rss: '',
    heapTotal: '',
    heapUsed: '',
  },
} as ApiSettings;

const uiContext: UiContextType = {
  mobile: false,
  setMobile: vi.fn(),
  currentPage: null,
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
  installAutoExit: true,
  setInstallAutoExit: vi.fn(),
};

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests settings, responds to status updates, and renders navigation', () => {
    const sendMessage = vi.fn();
    const removeListener = vi.fn();
    let listener: ((message: unknown) => void) | undefined;
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- This callback mirrors the WebSocket listener API.
    const addListener = vi.fn((callback: (message: unknown) => void) => {
      listener = callback;
    });
    const webSocketContext = {
      online: true,
      sendMessage,
      logMessage: vi.fn(),
      addListener,
      removeListener,
      getUniqueId: () => 42,
    } as unknown as WebSocketContextType;

    const { container, unmount } = render(
      <MemoryRouter>
        <WebSocketContext.Provider value={webSocketContext}>
          <UiContext.Provider value={uiContext}>
            <Header />
          </UiContext.Provider>
        </WebSocketContext.Provider>
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(sendMessage).toHaveBeenCalledWith({ id: 42, sender: 'Header', method: '/api/settings', src: 'Frontend', dst: 'Matterbridge', params: {} });
    expect(sendMessage).toHaveBeenCalledTimes(1);

    act(() => {
      listener?.({ method: '/api/settings', id: 42, response: settings });
    });

    expect(screen.getByText('Matterbridge')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Devices' })).toHaveAttribute('href', '/devices');
    expect(screen.getByText('v.3.9.2')).toBeInTheDocument();

    act(() => {
      listener?.({ method: 'refresh_required', response: { changed: 'settings' } });
      listener?.({ method: 'update_required', response: { devVersion: false, version: '3.9.3' } });
      listener?.({ method: 'restart_required', response: { fixed: false } });
    });

    expect(sendMessage).toHaveBeenCalledWith({ id: 42, sender: 'Header', method: '/api/settings', src: 'Frontend', dst: 'Matterbridge', params: {} });
    const updateButton = screen.getAllByTestId('SystemUpdateAltIcon')[0].closest('button');
    expect(updateButton).toBeInTheDocument();
    fireEvent.click(updateButton!);
    expect(sendMessage).toHaveBeenCalledWith({
      id: 42,
      sender: 'Header',
      method: '/api/install',
      src: 'Frontend',
      dst: 'Matterbridge',
      params: { packageName: 'matterbridge', restart: true },
    });

    const restartButton = screen.getAllByTestId('RestartAltIcon')[0].closest('button');
    expect(restartButton).toBeInTheDocument();
    fireEvent.click(restartButton!);
    expect(sendMessage).toHaveBeenCalledWith({ id: 42, sender: 'Header', method: '/api/restart', src: 'Frontend', dst: 'Matterbridge', params: {} });

    fireEvent.click(screen.getByRole('button', { name: 'Matterbridge Logo' }));
    expect(toggleDebug).toHaveBeenCalledOnce();

    act(() => {
      listener?.({ method: 'restart_not_required', response: {} });
    });

    unmount();
    expect(removeListener).toHaveBeenCalled();
  });
});
