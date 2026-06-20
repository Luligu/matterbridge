import '@testing-library/jest-dom';

import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ApiPlugin } from '../src/utils/backendShared';

vi.mock('../src/appState', () => ({ debug: false, enableMobile: true }));
vi.mock('../src/components/Connecting', () => ({ Connecting: () => <div>Connecting</div> }));
vi.mock('../src/components/ConfigPluginDialog', () => ({ ConfigPluginDialog: () => null }));
vi.mock('../src/components/MbfWindow', () => ({ MbfWindow: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../src/components/MbfTable', () => ({
  default: ({ rows }: { rows: ApiPlugin[] }) => (
    <div data-testid="plugin-versions">{rows.map((plugin) => `${plugin.name}:${plugin.latestVersion ?? ''}:${plugin.devVersion ?? ''}`).join('|')}</div>
  ),
}));

import HomePlugins from '../src/components/HomePlugins';
import { UiContext, type UiContextType } from '../src/components/UiContext';
import { WebSocketContext, type WebSocketContextType } from '../src/components/WebSocketProvider';

const plugins = [
  { name: 'plugin-one', version: '1.0.0', latestVersion: '1.0.0', devVersion: '1.0.0-dev' },
  { name: 'plugin-two', version: '2.0.0', latestVersion: '2.0.0', devVersion: '2.0.0-dev' },
] as ApiPlugin[];

const uiContext = { mobile: false, showConfirmCancelDialog: vi.fn() } as unknown as UiContextType;

describe('HomePlugins', () => {
  it('updates only the matching plugin version from a plugin update notification', () => {
    let listener: ((message: unknown) => void) | undefined;
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- This callback mirrors the WebSocket listener API.
    const addListener = vi.fn((callback: (message: unknown) => void) => {
      listener = callback;
    });
    const webSocketContext = {
      online: true,
      sendMessage: vi.fn(),
      addListener,
      removeListener: vi.fn(),
      getUniqueId: () => 7,
    } as unknown as WebSocketContextType;

    render(
      <WebSocketContext.Provider value={webSocketContext}>
        <UiContext.Provider value={uiContext}>
          <HomePlugins storeId={null} setStoreId={vi.fn()} />
        </UiContext.Provider>
      </WebSocketContext.Provider>,
    );

    act(() => {
      listener?.({ id: 7, method: '/api/plugins', response: plugins });
      listener?.({ id: 0, method: 'plugin_update_required', response: { plugin: 'plugin-one', version: '1.1.0', devVersion: false } });
    });
    expect(screen.getByTestId('plugin-versions')).toHaveTextContent('plugin-one:1.1.0:1.0.0-dev|plugin-two:2.0.0:2.0.0-dev');

    act(() => {
      listener?.({ id: 0, method: 'plugin_update_required', response: { plugin: 'plugin-two', version: '2.1.0-dev', devVersion: true } });
    });
    expect(screen.getByTestId('plugin-versions')).toHaveTextContent('plugin-one:1.1.0:1.0.0-dev|plugin-two:2.0.0:2.1.0-dev');
  });
});
