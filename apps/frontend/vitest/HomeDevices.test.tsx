import '@testing-library/jest-dom';

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { MbfTableColumn } from '../src/components/MbfTable';

vi.mock('../src/appState', () => ({ basePath: '/', debug: false, enableMobile: true }));
vi.mock('../src/components/Connecting', () => ({ Connecting: () => <div>Connecting</div> }));
vi.mock('../src/components/MbfWindow', () => ({ MbfWindow: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../src/components/MbfTable', () => ({
  default: <T extends object>({ rows, columns, getRowKey }: { rows: T[]; columns: MbfTableColumn<T>[]; getRowKey: (row: T) => string }) => (
    <div data-testid="devices-table">
      {rows.map((row) => {
        const actions = columns.find((column) => column.label === 'Actions');
        return <div key={getRowKey(row)}>{actions?.render?.(undefined, getRowKey(row), row, actions)}</div>;
      })}
    </div>
  ),
}));

import HomeDevices from '../src/components/HomeDevices';
import { UiContext, type UiContextType } from '../src/components/UiContext';
import { WebSocketContext, type WebSocketContextType } from '../src/components/WebSocketProvider';

const plugins = [
  {
    name: 'matterbridge-test',
    enabled: true,
    loaded: true,
    started: true,
    error: false,
    schemaJson: { properties: {} },
    configJson: { whiteList: [], blackList: [] },
  },
];

const uiContext = { mobile: false } as UiContextType;

function renderWithDevice(configUrl: string) {
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
        <HomeDevices storeId={null} setStoreId={vi.fn()} />
      </UiContext.Provider>
    </WebSocketContext.Provider>,
  );

  act(() => {
    listener?.({ id: 7, method: '/api/plugins', response: plugins });
  });
  act(() => {
    listener?.({ id: 7, method: '/api/devices', response: [{ pluginName: 'matterbridge-test', name: 'Test Device', serial: 'test1', configUrl }] });
  });
}

describe('HomeDevices', () => {
  it('opens the plugin frontend without corrupting a configUrl query string', () => {
    renderWithDevice('./plugins/matterbridge-test/?device=test1');

    fireEvent.click(screen.getByRole('button', { name: 'Open config url' }));

    expect(screen.getByTitle('Test Device frontend')).toHaveAttribute('src', '/plugins/matterbridge-test/?device=test1');
  });

  it('adds the trailing slash to the path when the configUrl has a query string but no trailing slash', () => {
    renderWithDevice('./plugins/matterbridge-test?device=test1');

    fireEvent.click(screen.getByRole('button', { name: 'Open config url' }));

    expect(screen.getByTitle('Test Device frontend')).toHaveAttribute('src', '/plugins/matterbridge-test/?device=test1');
  });

  it('adds the trailing slash to a configUrl without a query string', () => {
    renderWithDevice('/plugins/matterbridge-test');

    fireEvent.click(screen.getByRole('button', { name: 'Open config url' }));

    expect(screen.getByTitle('Test Device frontend')).toHaveAttribute('src', '/plugins/matterbridge-test/');
  });
});
