import '@testing-library/jest-dom';

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ApiSettings } from '../src/utils/backendShared';

vi.mock('../src/appState', () => ({ debug: false, enableMobile: true, setWssPassword: vi.fn() }));
vi.mock('../src/components/Connecting', () => ({ Connecting: () => <div>Connecting</div> }));
vi.mock('../src/components/MbfPage', () => ({ MbfPage: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('../src/components/MbfWindow', () => ({
  MbfWindow: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  MbfWindowContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MbfWindowHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  MbfWindowHeaderText: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('../src/components/ChangePasswordDialog', () => ({ ChangePasswordDialog: () => null }));
vi.mock('../src/components/NetworkConfigDialog', () => ({ NetworkConfigDialog: () => null }));

import Settings from '../src/components/Settings';
import { UiContext, type UiContextType } from '../src/components/UiContext';
import { WebSocketContext, type WebSocketContextType } from '../src/components/WebSocketProvider';

const settings = {
  matterbridgeInformation: {
    matterbridgeVersion: '3.9.2',
    matterbridgeLatestVersion: '3.9.3',
    matterbridgeDevVersion: '',
    rootDirectory: '/root',
    homeDirectory: '/home',
    matterbridgeDirectory: '/storage',
    matterbridgePluginDirectory: '/plugins',
    globalModulesDirectory: '/modules',
    bridgeMode: 'bridge',
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
    virtualMode: 'disabled',
    readOnly: false,
    shellyBoard: false,
  },
  systemInformation: {
    interfaceName: 'eth0',
    macAddress: '00:11:22:33:44:55',
    ipv4Address: '192.168.1.2',
    ipv6Address: '::1',
    nodeVersion: 'v24',
    hostname: 'matterbridge',
    user: 'user',
  },
} as ApiSettings;

const uiContext = { mobile: false } as UiContextType;

describe('Settings', () => {
  it('requests settings and saves a bridge-mode selection', () => {
    const sendMessage = vi.fn();
    const removeListener = vi.fn();
    let listener: ((message: unknown) => void) | undefined;
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- This callback mirrors the WebSocket listener API.
    const addListener = vi.fn((callback: (message: unknown) => void) => {
      listener = callback;
    });
    const webSocketContext = { online: true, sendMessage, addListener, removeListener, getUniqueId: () => 23 } as unknown as WebSocketContextType;
    const { unmount } = render(
      <WebSocketContext.Provider value={webSocketContext}>
        <UiContext.Provider value={uiContext}>
          <Settings />
        </UiContext.Provider>
      </WebSocketContext.Provider>,
    );

    expect(screen.getByText('Connecting')).toBeInTheDocument();
    expect(sendMessage).toHaveBeenCalledWith({ id: 23, sender: 'Settings', method: '/api/settings', src: 'Frontend', dst: 'Matterbridge', params: {} });

    act(() => {
      listener?.({ method: '/api/settings', id: 23, response: settings });
    });

    expect(screen.getByRole('heading', { name: 'Matterbridge settings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Matter settings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Matterbridge info' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'System info' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Childbridge'));
    expect(sendMessage).toHaveBeenCalledWith({
      id: 23,
      sender: 'Settings',
      method: '/api/config',
      src: 'Frontend',
      dst: 'Matterbridge',
      params: { name: 'setbridgemode', value: 'childbridge' },
    });

    unmount();
    expect(removeListener).toHaveBeenCalled();
  });
});
